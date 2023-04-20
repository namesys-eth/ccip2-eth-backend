import {
  Worker
} from 'worker_threads';
import { ethers } from 'ethers';
import 'isomorphic-fetch';
import { createRequire } from 'module';
import cors from 'cors';
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
app.use(cors({
	 origin: ['*'],
	headers: ['Content-Type']
}));
const options = {
	 key: fs.readFileSync('/root/.ssl/sshmatrix.club.key'),
	cert: fs.readFileSync('/root/.ssl/sshmatrix.club.crt'),
    ca: fs.readFileSync('/root/.ssl/sshmatrix.club.ca-bundle')
};
const root = '/root/ccip2';
const abi = ethers.utils.defaultAbiCoder;
function setHeader(cache) {
	return {
		'Allow': 'GET',
		'Access-Control-Allow-Origin': [
      'https://namesys-eth.github.io/ccip2-eth-client/',
      'https://ccip2.eth.limo/'
    ],
		'Content-Type': 'application/json',
		'Cache-Control': 'max-age=' + cache,
  }
}

app.get('/ping', async function (request, response) {
  // sends opaque response with error code 200 since in-browser CORS is not enabled
  // response.header(setHeader(6)); // uncomment this to allow in-browser CORS
	response.end('ccip2.eth backend is running in ' + root + ' on port ' + PORT + '\n');
});

app.get('/*', async function (request, response) {
  const env = process.env;
  const worker = new Worker(root + '/src/worker.js', {
    workerData: {
         url: request.url,
         body: request,
         env: JSON.stringify(env)
    }
  });
  worker.on("message", res => {
    response.header(setHeader(10));
    response.status(100);  // 100: SUCCESS
    response.json({ data: JSON.parse(res) }).end();
  });
  worker.on("error", error => {
    console.error(error);
    response.header(setHeader(2));
    response.status(407);  // 407: INTERNAL_ERROR
    response.json({ data: null }).end();
  });
  worker.on("exit");
});

console.log('ccip2.eth backend is running in ' + root + ' on port ' + PORT);
https.createServer(options,app).listen(PORT);
