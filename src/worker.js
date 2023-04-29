import {
  parentPort,
  workerData
} from 'worker_threads';
import { ethers } from 'ethers';
import { exec } from 'child_process';
import 'isomorphic-fetch';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import fs from 'fs';
require('dotenv').config();
const { keccak256 } = require("@ethersproject/solidity");
const process = require('process');
const mysql = require('mysql');

const types = [
	'name',
	'addr',
	'contenthash',
	'avatar',
	'revision'
] 
const EMPTY_STRING = {};
for (const key of types) {
	EMPTY_STRING[key] = '';
}
const EMPTY_BOOL = {};
for (const key of types) {
	EMPTY_BOOL[key] = false;
}

const connection = mysql.createConnection({
	host: process.env.MYSQL_HOST,
	user: process.env.MYSQL_USER,
	password: process.env.MYSQL_PASSWORD,
	database: process.env.MYSQL_DATABASE
});

connection.connect((err) => {
	if (err) {
		console.error('Error connecting to MySQL database:', err.stack);
		return;
	}
	console.log('Connected to MySQL database as ID:', connection.threadId);
});

async function handleCall(url, request) {
	//const mainnet = new ethers.providers.AlchemyProvider("homestead", process.env.ALCHEMY_KEY_MAINNET)
	const goerli = new ethers.providers.AlchemyProvider("goerli", process.env.ALCHEMY_KEY_GOERLI)
	let paths = url.toLowerCase().split('/');
	let nature = paths[paths.length - 1]
	let ens = request.ens;
	let chain = request.chain;
	let caip10 = 'eip155-' + chain + '-' + ens
	let signature = request.signature;
	let address = request.address;
	if (nature === 'read') {
		let response = {
			...EMPTY_STRING,
			type: nature
		}
		let recordsTypes = request.recordsTypes;
		let recordsValues = request.recordsValues;
		if (recordsTypes === 'all' && recordsValues === 'all') {
			let promises = [];
			for (let i = 0; i < 4; i++) {
				if (fs.existsSync(`/root/ccip2-data/${caip10}/${types[i]}.json`)) {
					let promise = new Promise((resolve, reject) => {
						fs.readFile(`/root/ccip2-data/${caip10}/${types[i]}.json`, function (err, data) {
							if (err) {
								reject(err);
							} else {
								var cache = JSON.parse(data)
								resolve(
									{ 
										type: types[i], 
										data: cache.data 
									}
								);
							}
						})
					});
					promises.push(promise);
				}
			}
			let results = await Promise.all(promises);
			results.forEach(result => {
				response[result.type] = result.data;
			});
			//console.log('Worker Read Response:', response)
			return JSON.stringify(response);
		} else {
			/* Do nothing */
		}
	} else if (nature === 'write') {
		let response = {
			...EMPTY_STRING,
			type: nature,
			ipfs: '',
			ipns: '',
			meta: EMPTY_BOOL
		}
		let ipns = request.ipns;
		// @TODO: Signature record
		let recordsTypes = request.recordsTypes;
		let recordsValues = request.recordsValues;
		let promises = []
		for (let i = 0; i < recordsTypes.length; i++) {
			let promise = new Promise((resolve, reject) => {
				if (!fs.existsSync(`/root/ccip2-data/${caip10}/`)) {
					fs.mkdirSync(`/root/ccip2-data/${caip10}/`);
				}
				fs.writeFile(`/root/ccip2-data/${caip10}/${recordsTypes[i]}.json`, 
					JSON.stringify(
						{
							data: recordsValues[recordsTypes[i]],
							timetamp: Date.now(),
							signer: address,
							domain: ens,
							signature: signature
						}
					), (err) => {
						if (err) {
							reject(err);
						} else {
							response.meta[recordsTypes[i]] = true
							response[recordsTypes[i]] = recordsValues[recordsTypes[i]]
							resolve()
						}
					}
				)
			});
			promises.push(promise);
		}
		await Promise.all([promises]);
		let command = `ipfs add -r /root/ccip2-data/${caip10}`;
		let ipfsCid;
		let pinIpfs = new Promise((resolve, reject) => {
			exec(command, (error, stdout, stderr) => {
				if (error !== null) {
					console.log('Fatal Error During Record Writing:', stderr)
					reject(error)
				} else {
					ipfsCid = stdout.split(' ')[1];
					response[recordsTypes] = recordsValues[recordsTypes]
					response.ipfs = 'ipfs://' + ipfsCid
					resolve()
					//let pinCmd = `ipfs pin add ${stdout.split(' ')[1]} && ipfs pin add ${ipns}`;
				}
			})
		})
		await Promise.all([pinIpfs]);
		let pinIpns = new Promise((resolve, reject) => {
			let pinCmd = `ipfs pin add ${ipfsCid}`;
			exec(pinCmd, (error, stdout, stderr) => {
				if (error !== null) {
					console.log('Fatal Error During IPNS Pinning:', stderr)
					reject(error)
				} else {
					response.ipns = 'ipns://' + ipns
					console.log('Successfully Pinned:', ipns)
					console.log('Making Database Entry...')
					connection.query(
						'INSERT INTO events (ens, timestamp, ipfs, ipns, meta) VALUES (?, ?, ?, ?, ?)',
						[ens, Date.now(), response.ipfs, response.ipns, JSON.stringify(response.meta)], 
						(error, results, fields) => {
						if (error) {
							console.error('Error executing database query:', error);
						}
						resolve()
					})
				}
			})
		})
		await Promise.all([pinIpns])
		return JSON.stringify(response)
	} else if (nature === 'revision') {
		let response = {
			status: false
		}
		let revision = request.revision;
		let promise = new Promise((resolve, reject) => {
			fs.writeFile(`/root/ccip2-data/${caip10}/revision.json`, 
				JSON.stringify(
					{
						data: revision,
						timetamp: Date.now(),
						signer: address,
						domain: ens,
						signature: signature 
					}
				), (err) => {
					if (err) {
						reject(err);
					} else {
						resolve()
						response.status = true
					}
				}
			)
		});
		await Promise.all([promise])
		return JSON.stringify(response)
	}
}

const url = workerData.url;
const request = JSON.parse(workerData.body);
const res = await handleCall(url, request);
let callback  = res;
parentPort.postMessage(callback);
