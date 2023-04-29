import {
  Worker
} from 'worker_threads';
import { ethers } from 'ethers';
import 'isomorphic-fetch';
import { createRequire } from 'module';
import cors from 'cors';
import fs from 'fs';
import https from 'https';
const require = createRequire(import.meta.url);
require('dotenv').config();
const crypto = require("crypto");
const express = require("express");
const process = require('process');
const key = process.env.PRIVATE_KEY;
const PORT = 3003
const app = express();
app.use(express.json());
app.use(
  cors(
      {
      origin: [
         "http://localhost:3000",
         "https://ccip2.eth.limo",
         "https://namesys-eth.github.io"
      ],
      headers: [
      'Content-Type',
      ],
    }
  )
);

const options = {
	 key: fs.readFileSync('/root/.ssl/sshmatrix.club.key'),
	cert: fs.readFileSync('/root/.ssl/sshmatrix.club.crt'),
    ca: fs.readFileSync('/root/.ssl/sshmatrix.club.ca-bundle')
};

const root = '/root/ccip2';
const abi = ethers.utils.defaultAbiCoder;

function errorHandler(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).send({ error: 'Bad request' });
  }
  next();
}
app.use(errorHandler);

app.get('/ping', async function (request, response) {
  console.log('ping')
  // sends opaque response with error code 200 since in-browser CORS is not enabled
  response.header("Access-Control-Allow-Origin", 
    '*'
  );
	response.end('ccip2.eth backend is running in ' + root + ' on port ' + PORT + '\n');
});

app.route(['/read', '/write', '/revision'])
  .post(async function (request, response) {
    response.header("Access-Control-Allow-Origin",
      "http://localhost:3000",
      "https://ccip2.eth.limo",
      "https://namesys-eth.github.io"
    );
    let paths = request.url.toLowerCase().split('/');
    let nature = paths[paths.length - 1]
    console.log(`Handling ${nature.toUpperCase()} Request...`)
    if (!request.body || Object.keys(request.body).length === 0 || !['read', 'write', 'revision'].includes(nature)) {
      response.end(`Forbidden Empty ${nature.toUpperCase()} Request\n`);
    } else {
      console.log(`Parsing Legit ${nature.toUpperCase()} Request...`)
      const worker = new Worker(root + '/src/worker.js', {
        workerData: {
            url: request.url,
            body: JSON.stringify(request.body)
        }
      });
      worker.on("message", _response => {
        console.log(`Worker answering ${nature.toUpperCase()}...`)
        response.status(200);  // 200: SUCCESS
        response.json({ response: JSON.parse(_response) }).end();
      });
      worker.on("error", _error => {
        console.log(`Worker error in ${nature.toUpperCase()}...`)
        console.error(_error);
        response.status(407);  // 407: INTERNAL_ERROR
        response.json({ response: null }).end();
      });
      worker.on("exit", () => {
        console.log(`Worker quitting after ${nature.toUpperCase()}...`)
      });
    }
});

console.log('ccip2.eth backend is running in ' + root + ' on port ' + PORT);
https.createServer(options, app).listen(PORT);
