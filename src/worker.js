import {
	parentPort,
	workerData
} from 'worker_threads'
import { ethers } from 'ethers'
import { exec } from 'child_process'
import 'isomorphic-fetch'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
import fs from 'fs'
require('dotenv').config()
const { keccak256 } = require("@ethersproject/solidity")
const process = require('process')
const mysql = require('mysql')
const path = require('path')

// Safely make directories recursively 'mkdir -p a/b/c' equivalent
function mkdirpSync(directoryPath) {
	const parts = directoryPath.split(path.sep)
	for (let i = 4; i <= parts.length; i++) {
		const currentPath = '/' + path.join(...parts.slice(0, i))
		console.log(iterator, ':', 'Checking DIR: ', currentPath)
		if (!fs.existsSync(currentPath)) {
			console.log(iterator, ':', 'Making DIR:  ', currentPath)
			fs.mkdirSync(currentPath)
		}
	}
}

function sumValues(obj) {
	let total = 0
	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			total += obj[key]
		}
	}
	return total
}

const types = [
	'addr',
	'contenthash',
	'avatar',
	'zonehash',
	'revision'
]
const files = [
	'address/60',
	'contenthash',
	'text/avatar',
	'dnsrecord/zonehash',
	'revision'
]
const EMPTY_STRING = {}
for (const key of types) {
	EMPTY_STRING[key] = ''
}
const EMPTY_BOOL = {}
for (const key of types) {
	EMPTY_BOOL[key] = false
}

const Launch = '1690120000' 

const connection = mysql.createConnection({
	host: process.env.MYSQL_HOST,
	user: process.env.MYSQL_USER,
	password: process.env.MYSQL_PASSWORD,
	database: process.env.MYSQL_DATABASE
})

async function handleCall(url, request, iterator) {
	connection.connect((err) => {
		if (err) {
			console.error(iterator, ':', 'Error connecting to MySQL database:', err.stack)
			return
		}
		console.log(iterator, ':', 'Connected to MySQL database as ID:', connection.threadId)
	})
	//const mainnet = new ethers.providers.AlchemyProvider("homestead", process.env.ALCHEMY_KEY_MAINNET)
	const goerli = new ethers.providers.AlchemyProvider("goerli", process.env.ALCHEMY_KEY_GOERLI)
	let paths = url.toLowerCase().split('/')
	let nature = paths[paths.length - 1]
	/// If gas call
	if (nature === 'gas') {
		let response = {
			gas: '0'
		}
		let promises = []
		let promise = new Promise((resolve, reject) => {
			connection.query(`SELECT gas FROM events WHERE timestamp > ${Launch}`, function (error, results, fields) {
				if (error) {
					console.error('Error reading gas from database:', error)
					return
				}
				const _values = results.map(row => row['gas'])
				const _sum = _values.reduce((acc, val) => acc + parseFloat(val), 0)
				resolve(
					{
						type: 'gas',
						data: _sum.toFixed(4).toString()
					}
				)
			})
			console.log(iterator, ':', 'Closing MySQL Connection')
			connection.end()
		})
		promises.push(promise)
		let results = await Promise.all(promises)
		results.forEach(result => {
			response[result.type] = result.data
		})
		return JSON.stringify(response)
	}
	/// Remaining calls
	let ens = request.ens
	let chain = request.chain
	let caip10 = 'eip155-' + chain + '-' + ens
	let owner = request.owner
	let writePath = '.well-known/' + ens.split(".").reverse().join("/")
	// If 
	if (nature === 'read') {
		let response = {
			...EMPTY_STRING,
			type: nature,
			timestamp: {...EMPTY_STRING}
		}
		let recordsTypes = request.recordsTypes
		let recordsValues = request.recordsValues
		let ownerhash = request.ownerhash
		// Get Ownerhash timestamps
		if (ownerhash !== '0x0') {
			let promises = []
			let promise = new Promise((resolve, reject) => {
				connection.query(`SELECT timestamp FROM events WHERE ipns = '${ownerhash}'`, function (error, results, fields) {
					if (error) {
						console.error('Error reading ownerhash from database:', error)
						return
					}
					const _values = results.map(row => row['timestamp'])
					resolve(
						{
							type: 'ownerstamp',
							data: _values
						}
					)
				})
				console.log(iterator, ':', 'Closing MySQL Connection')
				connection.end()
			})
			promises.push(promise)
			let results = await Promise.all(promises)
			results.forEach(result => {
				response[result.type] = result.data
			})
		} else {
			response['ownerstamp'] = []
		}
		if (recordsTypes === 'all' && recordsValues === 'all') {
			let promises = []
			for (let i = 0; i < 4; i++) {
				if (fs.existsSync(`/root/ccip2-data/${caip10}/${writePath}/${files[i]}.json`)) {
					let promise = new Promise((resolve, reject) => {
						fs.readFile(`/root/ccip2-data/${caip10}/${writePath}/${files[i]}.json`, function (err, data) {
							if (err) {
								reject(err)
							} else {
								var cache = JSON.parse(data)
								resolve(
									{
										type: types[i],
										data: cache.raw,
										timestamp: cache.timestamp
									}
								)
							}
						})
					})
					promises.push(promise)
				}
			}
			let results = await Promise.all(promises)
			results.forEach(result => {
				response[result.type] = result.data
				response.timestamp[result.type] = result.timestamp
			})
			//console.log('Worker Read Response:', response)
			return JSON.stringify(response)
		} else {
			/* Do nothing */
		}
	} else if (nature === 'write') {
		let timestamp = Math.round(Date.now() / 1000)
		let response = {
			...EMPTY_STRING,
			type: nature,
			ipfs: '',
			ipns: '',
			meta: EMPTY_BOOL,
			timestamp: {...EMPTY_STRING}
		}
		let ipns = request.ipns
		let recordsTypes = request.recordsTypes
		let recordsValues = request.recordsValues
		let recordsRaw = request.recordsRaw
		let signatures = request.signatures
		let manager = request.manager
		let managerSig = request.managerSignature
		let promises = []
		let recordsFiles = [...recordsTypes]
		for (let i = 0; i < recordsTypes.length; i++) {
			// Set filenames for non-standard records
			recordsFiles[i] = files[types.indexOf(recordsTypes[i])]
			let promise = new Promise((resolve, reject) => {
				// Make strict directory structure for TYPES[]
				if (!fs.existsSync(`/root/ccip2-data/${caip10}/${writePath}/`)) {
					mkdirpSync(`/root/ccip2-data/${caip10}/${writePath}/`) // Make repo if it doesn't exist
				}
				// Make further sub-directories when needed in FILES[]
				let subRepo = path.dirname(`/root/ccip2-data/${caip10}/${writePath}/${recordsFiles[i]}.json`)
				if (!fs.existsSync(subRepo)) {
					if (recordsFiles[i].includes('/')) {
						mkdirpSync(subRepo) // Make repo 'parent/child' if it doesn't exist
					} else {
						fs.mkdirSync(subRepo) // Make repo if it doesn't exist
					}
				}
				// Write record
				fs.writeFile(`/root/ccip2-data/${caip10}/${writePath}/${recordsFiles[i]}.json`,
					JSON.stringify(
						{
							domain: ens,
							data: recordsValues[recordsTypes[i]],
							raw: recordsRaw[recordsTypes[i]],
							timestamp: timestamp,
							signer: manager,
							owner: owner,
							managerSignature: managerSig,
							recordSignature: signatures[recordsTypes[i]]
						}
					), (err) => {
						if (err) {
							console.log(iterator, ':', 'Fatal Error During Record Writing:', err)
							reject(err)
						} else {
							response.meta[recordsTypes[i]] = true
							response[recordsTypes[i]] = recordsRaw[recordsTypes[i]]
							response.timestamp[recordsTypes[i]] = timestamp
							console.log(iterator, ':', 'Successfully Wrote Record:', `${recordsFiles[i]}`)
							resolve()
						}
					}
				)
			})
			promises.push(promise)
		}
		await Promise.all([promises])
		let command = `ipfs add -r --hidden /root/ccip2-data/${caip10}`
		let ipfsCid
		let pinIpfs = new Promise((resolve, reject) => {
			exec(command, (error, stdout, stderr) => {
				if (error !== null) {
					console.log(iterator, ':', 'Fatal Error During IPFS Pinning (411):', stderr)
					reject(error)
				} else {
					const lines = stdout.trim().split('\n');
					const secondLastLine = lines[lines.length - 1];
					ipfsCid = secondLastLine.split(' ')[1]
					response.ipfs = 'ipfs://' + ipfsCid
					resolve()
					//let pinCmd = `ipfs pin add ${stdout.split(' ')[1]} && ipfs pin add ${ipns}`
				}
			})
		})
		await Promise.all([pinIpfs])
		let pinIpns = new Promise((resolve, reject) => {
			let pinCmd = `ipfs pin add ${ipfsCid}`
			exec(pinCmd, (error, stdout, stderr) => {
				if (error !== null) {
					console.log(iterator, ':', 'Fatal Error During IPFS Pinning (412):', stderr)
					reject(error)
				} else {
					//console.log(iterator, ':', 'IPFS Daemon Says:', stdout)
					response.ipns = 'ipns://' + ipns
					console.log(iterator, ':', `Recursively Pinned: ipfs://${ipfsCid}`)
					console.log(iterator, ':', 'Making Database Entry...')
					connection.query(
						'INSERT INTO events (ens, timestamp, ipfs, ipns, revision, gas, meta) VALUES (?, ?, ?, ?, ?, ?, ?)',
						[caip10, timestamp, response.ipfs, response.ipns, '0x0', '0', JSON.stringify(response.meta)],
						(error, results, fields) => {
							if (error) {
								console.error('Error executing database entry:', error)
							}
							resolve()
						})
					//console.log(iterator, ':', 'Closing MySQL Connection')
					//connection.end()
				}
			})
		})
		await Promise.all([pinIpns])
		return JSON.stringify(response)
	} else if (nature === 'revision') {
		let response = {
			status: false
		}
		let revision = request.revision
		let version = JSON.parse(request.version.replace('\\', ''))
		let gas = JSON.parse(request.gas)
		let manager = request.manager
		let managerSig = request.managerSignature
		let promise = new Promise((resolve, reject) => {
			// Decoded version metadata utilised by NameSys
			fs.writeFile(`/root/ccip2-data/${caip10}/revision.json`,
				JSON.stringify(
					{
						domain: ens,
						data: revision,
						timestamp: request.timestamp,
						signer: manager,
						owner: owner,	
						managerSignature: managerSig,
						gas: sumValues(gas).toPrecision(3)
					}
				), (err) => {
					if (err) {
						reject(err)
					} else {
						console.log(iterator, ':', 'Making Database Revision...')
						let _revision = new Uint8Array(Object.values(revision)).toString('utf-8')
						connection.query(
							`UPDATE events SET revision = ?, gas = ? WHERE ens = ? AND revision = '0x0' AND gas = '0'`,
							[_revision, chain === '1' ? sumValues(gas).toPrecision(3).toString() : '0.000', caip10],
							(error, results, fields) => {
								if (error) {
									console.error('Error executing database revision:', error)
								}
							})
						console.log(iterator, ':', 'Closing MySQL Connection')
						connection.end()
					}
				}
			)
			// Encoded version metadata required by W3Name to republish IPNS records
			fs.writeFile(`/root/ccip2-data/${caip10}/version.json`,
				JSON.stringify(
					version
				), (err) => {
					if (err) {
						reject(err)
					} else {
						console.log(iterator, ':', 'Making Version File...')
						response.status = true
						resolve()
					}
				}
			)
		})
		await Promise.all([promise])
		return JSON.stringify(response)
	}
}

const url = workerData.url
const request = JSON.parse(workerData.body)
const iterator = JSON.parse(workerData.iterator)
const res = await handleCall(url, request, iterator)
let callback = res
parentPort.postMessage(callback)