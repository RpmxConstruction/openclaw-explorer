const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const http = require("http");

const app = express();
const PORT = 3847;
const ROOT_PATH = "C:\\nodejs\\node_modules\\openclaw";
const GATEWAY_URL = "http://10.0.4.23:3848";
const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit

// Text file extensions
const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".js", ".ts", ".jsx", ".tsx", ".css", ".html", ".htm",
  ".xml", ".yaml", ".yml", ".toml", ".ini", ".conf", ".cfg", ".env", ".sh", ".bash",
  ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp", ".cs", ".php",
  ".sql", ".log", ".csv", ".gitignore", ".dockerignore", ".editorconfig"
]);

function isTextFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ext === "" || TEXT_EXTENSIONS.has(ext);
}

app.use(express.static("public"));
app.use(express.json({ limit: "2mb" }));

// Local tree
app.get("/api/tree", async (req, res) => {
  const relativePath = req.query.path || "";
  const fullPath = path.join(ROOT_PATH, relativePath);
  
  try {
    const realPath = await fs.realpath(fullPath);
    const realRoot = await fs.realpath(ROOT_PATH);
    if (!realPath.startsWith(realRoot)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const items = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? "folder" : "file",
      path: path.join(relativePath, entry.name).replace(/\\/g, "/")
    }));
    
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Local read
app.get("/api/read", async (req, res) => {
  const relativePath = req.query.path || "";
  if (!relativePath) return res.status(400).json({ error: "Path required" });
  
  const fullPath = path.join(ROOT_PATH, relativePath);
  
  try {
    const realPath = await fs.realpath(fullPath);
    const realRoot = await fs.realpath(ROOT_PATH);
    if (!realPath.startsWith(realRoot)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) return res.status(400).json({ error: "Cannot read directory" });
    if (stat.size > MAX_FILE_SIZE) return res.status(413).json({ error: "File too large" });
    if (!isTextFile(path.basename(fullPath))) return res.status(415).json({ error: "Binary not supported" });
    
    const content = await fs.readFile(fullPath, "utf-8");
    res.json({ content, size: stat.size });
  } catch (err) {
    if (err.code === "ENOENT") return res.status(404).json({ error: "Not found" });
    res.status(500).json({ error: err.message });
  }
});

// Local write
app.post("/api/write", async (req, res) => {
  const { path: relativePath, content } = req.body;
  if (!relativePath) return res.status(400).json({ error: "Path required" });
  if (typeof content !== "string") return res.status(400).json({ error: "Content required" });
  
  const fullPath = path.join(ROOT_PATH, relativePath);
  
  try {
    const realRoot = await fs.realpath(ROOT_PATH);
    const parentDir = path.dirname(fullPath);
    const realParent = await fs.realpath(parentDir);
    
    if (!realParent.startsWith(realRoot)) return res.status(403).json({ error: "Access denied" });
    if (!isTextFile(path.basename(fullPath))) return res.status(415).json({ error: "Binary not supported" });
    if (Buffer.byteLength(content, "utf-8") > MAX_FILE_SIZE) return res.status(413).json({ error: "Too large" });
    
    await fs.writeFile(fullPath, content, "utf-8");
    res.json({ success: true, size: Buffer.byteLength(content, "utf-8") });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gateway proxy - tree
app.get("/api/gateway/tree", async (req, res) => {
  const relativePath = req.query.path || "";
  const url = `${GATEWAY_URL}/api/tree?path=${encodeURIComponent(relativePath)}`;
  
  try {
    const response = await httpGet(url);
    res.status(response.status).type("json").send(response.data);
  } catch (err) {
    res.status(502).json({ error: "Gateway unreachable: " + err.message });
  }
});

// Gateway proxy - read
app.get("/api/gateway/read", async (req, res) => {
  const relativePath = req.query.path || "";
  const url = `${GATEWAY_URL}/api/read?path=${encodeURIComponent(relativePath)}`;
  
  try {
    const response = await httpGet(url);
    res.status(response.status).type("json").send(response.data);
  } catch (err) {
    res.status(502).json({ error: "Gateway unreachable: " + err.message });
  }
});

// Gateway proxy - write
app.post("/api/gateway/write", async (req, res) => {
  const { path: relativePath, content } = req.body;
  
  try {
    const response = await httpPost(`${GATEWAY_URL}/api/write`, { path: relativePath, content });
    res.status(response.status).type("json").send(response.data);
  } catch (err) {
    res.status(502).json({ error: "Gateway unreachable: " + err.message });
  }
});

// HTTP helpers
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: 10000 }, (response) => {
      let data = "";
      response.on("data", chunk => data += chunk);
      response.on("end", () => resolve({ status: response.statusCode, data }));
    });
    request.on("error", reject);
    request.on("timeout", () => { request.destroy(); reject(new Error("Timeout")); });
  });
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = JSON.stringify(body);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: "POST",
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    };
    
    const request = http.request(options, (response) => {
      let result = "";
      response.on("data", chunk => result += chunk);
      response.on("end", () => resolve({ status: response.statusCode, data: result }));
    });
    
    request.on("error", reject);
    request.on("timeout", () => { request.destroy(); reject(new Error("Timeout")); });
    request.write(data);
    request.end();
  });
}

app.listen(PORT, () => {
  console.log(`OpenClaw Explorer running at http://localhost:${PORT}`);
});
