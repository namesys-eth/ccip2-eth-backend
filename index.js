import {
  Worker
} from 'worker_threads'
import { ethers } from 'ethers'
import 'isomorphic-fetch'
import { createRequire } from 'module'
import cors from 'cors'
import fs from 'fs'
import https from 'https'
const require = createRequire(import.meta.url)
require('dotenv').config()
const crypto = require("crypto")
const express = require("express")
const process = require('process')
const key = process.env.PRIVATE_KEY
const PORT = 3003
const app = express()
app.use(express.json())

const CORS = [
  "https://ccip2.eth.limo",
  "https://namesys.eth.limo",
  "https://namesys.xyz",
  "https://namesys-eth.github.io"
]

app.use(
  cors(
      {
      origin: CORS,
      headers: [
      'Content-Type',
      ],
    }
  )
)

const CREATE_TABLE= `CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ens VARCHAR(255) NOT NULL,
  timestamp BIGINT NOT NULL,
  ipfs VARCHAR(255) NOT NULL,
  ipns VARCHAR(255) NOT NULL,
  revision VARCHAR(1023) NOT NULL,
  gas VARCHAR(127) NOT NULL,
  meta JSON NOT NULL
)`

const options = {
	 key: fs.readFileSync('/root/.ssl/sshmatrix.club.key'),
	cert: fs.readFileSync('/root/.ssl/sshmatrix.club.crt'),
    ca: fs.readFileSync('/root/.ssl/sshmatrix.club.ca-bundle')
}

const root = '/root/ccip2'
const abi = ethers.utils.defaultAbiCoder
var count = 0
const routes = ['/read', '/write', '/revision', '/gas']

function errorHandler(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).send({ error: 'Bad request' })
  }
  next()
}
app.use(errorHandler)

app.get('/ping', async function (request, response) {
  console.log('ping')
  // sends opaque response with error code 200 since in-browser CORS is not enabled
  response.header("Access-Control-Allow-Origin", 
    '*'
  )
	response.end('ccip2.eth backend is running in ' + root + ' on port ' + PORT + '\n')
})

app.route(routes)
  .post(async function (request, response) {
    response.header("Access-Control-Allow-Origin",
      CORS[0], CORS[1], CORS[2], CORS[3], CORS[4]
    )
    let paths = request.url.toLowerCase().split('/')
    let nature = paths[paths.length - 1]
    count = count + 1
    console.log(count, ':', `Handling ${nature.toUpperCase()} Request...`)
    if (!request.body || Object.keys(request.body).length === 0 || !routes.includes('/' + nature)) {
      response.end(`Forbidden Empty ${nature.toUpperCase()} Request\n`)
    } else {
      console.log(count, ':', `Parsing Legit ${nature.toUpperCase()} Request...`)
      const worker = new Worker(root + '/src/worker.js', {
        workerData: {
            url: request.url,
            body: JSON.stringify(request.body),
            iterator: count
        }
      })
      worker.on("message", _response => {
        console.log(count, ':', `Worker answering ${nature.toUpperCase()}...`)
        response.status(200)  // 200: SUCCESS
        response.json({ response: JSON.parse(_response) }).end()
      })
      worker.on("error", _error => {
        console.log(count, ':', `Worker error in ${nature.toUpperCase()}...`)
        console.error(_error)
        response.status(407)  // 407: INTERNAL_ERROR
        response.json({ response: null }).end()
      })
      worker.on("exit", () => {
        console.log(count, ':', `Worker quitting after ${nature.toUpperCase()}...`)
      })
    }
})

console.log('ccip2.eth backend is running in ' + root + ' on port ' + PORT)
https.createServer(options, app).listen(PORT)
