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
const path = require('path');

// Safely make directories recursively; 'mkdir -p a/b/c' equivalent
function mkdirpSync(directoryPath) {
	const parts = directoryPath.split(path.sep);
	for (let i = 4; i <= parts.length; i++) {
	  const currentPath = '/' + path.join(...parts.slice(0, i));
	  console.log('Checking DIR: ', currentPath)
	  if (!fs.existsSync(currentPath)) {
		console.log('Making DIR: ', currentPath)
		fs.mkdirSync(currentPath);
	  }
	}
  }

function sumValues(obj) {
	let total = 0;
	for (const key in obj) {
	  if (obj.hasOwnProperty(key)) {
		total += obj[key];
	  }
	}
	return total;
  }

const types = [
	'name',
	'addr',
	'contenthash',
	'avatar',
	'zonehash',
	'revision'
] 
const files = [
	'name',
	'_address/60',
	'contenthash',
	'text/avatar',
	'_dnsrecord/zonehash',
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
	/// If gas call
	if (nature === 'gas') {
		let response = {
			gas: '0'
		}
		let promises = []
		let promise = new Promise((resolve, reject) => { 
			connection.query('SELECT gas FROM events', function (error, results, fields) {
				if (error) {
					console.error('Error reading gas from database:', error);
					return;
				}
				const _values = results.map(row => row['gas']);
				const _sum = _values.reduce((acc, val) => acc + parseFloat(val), 0);
				resolve(
					{ 
						type: 'gas', 
						data: _sum.toString()
					}
				);
			});
		})
		promises.push(promise);
		let results = await Promise.all(promises);
		results.forEach(result => {
			response[result.type] = result.data;
		});
		return JSON.stringify(response)
	}
	/// Remaining calls
	let ens = request.ens;
	let chain = request.chain;
	let caip10 = 'eip155-' + chain + '-' + ens
	let address = request.address;
	let writePath = '.well-known/' + ens.split(".").reverse().join("/")
	// If 
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
				if (fs.existsSync(`/root/ccip2-data/${caip10}/${writePath}/${files[i]}.json`)) {
					let promise = new Promise((resolve, reject) => {
						fs.readFile(`/root/ccip2-data/${caip10}/${writePath}/${files[i]}.json`, function (err, data) {
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
		let signatures = request.signatures;
		let promises = []
		let recordsFiles = recordsTypes;
		for (let i = 0; i < recordsTypes.length; i++) {
			// Set filenames for non-standard records
			if (recordsTypes[i] === 'addr') {
				recordsFiles[i] = '_address/60';
			} else if (recordsTypes[i] === 'zonehash') {
				recordsFiles[i] = '_dnsrecord/zonehash';
			} else if (recordsTypes[i] === 'avatar') {
				recordsFiles[i] = 'text/avatar';
			} else {
				recordsFiles[i] = recordsTypes[i]
			}
			let promise = new Promise((resolve, reject) => {
				// Make strict directory structure for TYPES[]
				if (!fs.existsSync(`/root/ccip2-data/${caip10}/${writePath}/`)) {
					mkdirpSync(`/root/ccip2-data/${caip10}/${writePath}/`);
				}
				// Make further sub-directories when needed in FILES[]
				let subRepo = path.dirname(`/root/ccip2-data/${caip10}/${writePath}/${recordsFiles[i]}.json`)
				if (!fs.existsSync(subRepo)) {
					fs.mkdirSync(subRepo)
				}
				// Write record
				fs.writeFile(`/root/ccip2-data/${caip10}/${writePath}/${recordsFiles[i]}.json`, 
					// TODO - encode response with signature
					JSON.stringify(
						{
							data: recordsValues[recordsTypes[i]],
							timetamp: Date.now(),
							signer: address,
							domain: ens,
							signature: signatures[i]
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
						'INSERT INTO events (ens, timestamp, ipfs, ipns, revision, gas, meta) VALUES (?, ?, ?, ?, ?, ?, ?)',
						[ens, Date.now(), response.ipfs, response.ipns, '0x0', '0', JSON.stringify(response.meta)], 
						(error, results, fields) => {
						if (error) {
							console.error('Error executing database entry:', error);
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
		let version = JSON.parse(request.version.replace('\\',''));
		let gas = JSON.parse(request.gas)
		let promise = new Promise((resolve, reject) => {
			// Decoded version metadata utilised by NameSys
			fs.writeFile(`/root/ccip2-data/${caip10}/revision.json`, 
				JSON.stringify(
					{
						data: revision,
						timestamp: Date.now(),
						signer: address,
						domain: ens,
						gas: sumValues(gas).toPrecision(3)
					}
				), (err) => {
					if (err) {
						reject(err);
					} else {
						console.log('Making Database Revision...')
						let _revision = new Uint8Array(Object.values(revision)).toString('utf-8')
						connection.query(
							`UPDATE events SET revision = ?, gas = ? WHERE ens = ? AND revision = '0x0' AND gas = '0'`,
							[_revision, sumValues(gas).toPrecision(3).toString(), ens], 
							(error, results, fields) => {
							if (error) {
								console.error('Error executing database revision:', error);
							}
						})
					}
				}
			)
			// Encoded version metadata required by W3Name to republish IPNS records
			fs.writeFile(`/root/ccip2-data/${caip10}/version.json`, 
				JSON.stringify(
					version
				), (err) => {
					if (err) {
						reject(err);
					} else {
						console.log('Making Version File...')
						response.status = true
						resolve()
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
connection.end();
parentPort.postMessage(callback);