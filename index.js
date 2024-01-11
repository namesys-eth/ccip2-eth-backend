import { Worker } from "worker_threads";
import { ethers } from "ethers";
import "isomorphic-fetch";
import { createRequire } from "module";
import cors from "cors";
import fs from "fs";
import https from "https";
const require = createRequire(import.meta.url);
require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const process = require("process");
const key = process.env.PRIVATE_KEY;
const PORT = process.env.PORT;
const app = express();
app.use(express.json());

const CORS = [
  "https://ccip2.eth.limo",
  "https://namesys.eth.limo",
  "https://namesys.xyz",
  "https://namesys-eth.github.io",
  "https://ccip2.eth.casa",
  "https://namesys.eth.casa",
  "https://ccip2.eth.li",
  "https://namesys.eth.li",
  "https://lite.namesys.xyz",
  "https://app.namesys.xyz",
  "https://lite.namesys.eth.limo",
  "https://app.namesys.eth.limo",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: CORS,
    headers: ["Content-Type"],
  })
);

const CREATE_TABLE = `CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ens VARCHAR(255) NOT NULL,
  timestamp BIGINT NOT NULL,
  ipfs VARCHAR(255) NOT NULL,
  ipns VARCHAR(255) NOT NULL,
  revision VARCHAR(1023) NOT NULL,
  gas VARCHAR(127) NOT NULL,
  meta JSON NOT NULL
)`;

const options = {
  key: fs.readFileSync("/etc/letsencrypt/live/ipfs.namesys.xyz/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/ipfs.namesys.xyz/cert.pem"),
  ca: [fs.readFileSync("/etc/letsencrypt/live/ipfs.namesys.xyz/chain.pem")],
};

const root = "/root/ccip2";
const abi = ethers.utils.defaultAbiCoder;
var count = 0;
const routes = ["/read", "/write", "/revision", "/gas"];

function errorHandler(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).send({ error: "Bad request" });
  }
  next();
}
app.use(errorHandler);

app.get("/ping", async function (request, response) {
  console.log("ping");
  // sends opaque response with error code 200 since in-browser CORS is not enabled
  response.header("Access-Control-Allow-Origin", "*");
  response.end(
    "NameSys.eth backend is running in " + root + " on port " + PORT + "\n"
  );
});

app.route(routes).post(async function (request, response) {
  response.header(
    "Access-Control-Allow-Origin",
    CORS[0],
    CORS[1],
    CORS[2],
    CORS[3],
    CORS[4],
    CORS[5],
    CORS[6],
    CORS[7],
    CORS[8],
    CORS[9],
    CORS[10],
    CORS[11],
    CORS[12]
  );
  let paths = request.url.toLowerCase().split("/");
  let nature = paths[paths.length - 1];
  count = count + 1;
  console.log(count, ":", `Handling ${nature.toUpperCase()} Request...`);
  if (
    !request.body ||
    Object.keys(request.body).length === 0 ||
    !routes.includes("/" + nature)
  ) {
    response.end(`Forbidden Empty ${nature.toUpperCase()} Request\n`);
  } else {
    console.log(count, ":", `Parsing Legit ${nature.toUpperCase()} Request...`);
    const worker = new Worker(root + "/src/worker.js", {
      workerData: {
        url: request.url,
        body: JSON.stringify(request.body),
        iterator: count,
      },
    });
    worker.on("message", (_response) => {
      if (_response.type === "log") {
        console.log(_response.message); // Log messages from the worker
      } else {
        console.log(count, ":", `Worker answering ${nature.toUpperCase()}...`);
        response.status(200); // 200: SUCCESS
        response.json({ response: JSON.parse(_response) }).end();
      }
    });
    worker.on("error", (_error) => {
      console.log(count, ":", `Worker error in ${nature.toUpperCase()}...`);
      console.error(_error);
      response.status(407); // 407: INTERNAL_ERROR
      response.json({ response: null }).end();
    });
    worker.on("exit", () => {
      console.log(
        count,
        ":",
        `Worker quitting after ${nature.toUpperCase()}...`
      );
    });
  }
});

console.log("NameSys.eth backend is running in " + root + " on port " + PORT);
https.createServer(options, app).listen(PORT);
