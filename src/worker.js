import {
  parentPort,
  workerData
} from 'worker_threads';
import { ethers } from 'ethers';
import 'isomorphic-fetch';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import fs from 'fs';
require('dotenv').config();
const { keccak256 } = require("@ethersproject/solidity");

const chains = {
	"ethereum": [
		"https://rpc.ankr.com/eth",
		"https://eth-rpc.gateway.pokt.network",
		`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY_MAINNET}`
	],
	"gnosis":   [ "https://rpc.ankr.com/gnosis"  ],
	"polygon":  [ "https://rpc.ankr.com/polygon"  ],
	"arbitrum": [ "https://rpc.ankr.com/arbitrum"  ],
	"goerli":   [
		"https://rpc.ankr.com/eth_goerli",
		`https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_KEY_GOERLI}`
	]
};
const ttl = 600;
const headers = {
	"Allow": "GET",
	"Content-Type": "application/json",
	"Access-Control-Allow-Origin": "*"
};

const mainnet = new ethers.providers.AlchemyProvider("homestead", process.env.ALCHEMY_KEY_MAINNET);
const goerli = new ethers.providers.AlchemyProvider("goerli", process.env.ALCHEMY_KEY_GOERLI)
const types = [
	'name',
	'addr',
	'contenthash',
	'avatar'
]

async function handleCall(url, request, env) {
	let paths = url.toLowerCase().split('/');
	let nature = paths[paths.length]
	if (nature === 'read') {
		let response = {
			type: nature,
			name: '',
			addr: '',
			contenthash: '',
			avatar: ''
		}
		let ens = request.body.ens;
		let recordType = request.body.recordType;
		let recordValue = request.body.recordValue;
		if (recordType === recordValue === 'all') {
			for (i = 0; i < 4; i++) {
				fs.readFile(`/root/ccip2-data/${ens}/${types[i]}.json`, function (err, data) {
					var cache = JSON.parse(data)
					if (i === 0) {
						response.name = cache.data
					} else if (i === 1) {
						response.addr = cache.data
					} else if (i === 2) {
						response.contenthash = cache.data
					} else if (i === 3) {
						response.avatar = cache.data
					}
				})
			}
			return response
		} else {
			/* Do nothing */
		}
	} else if (nature == 'write') {
		let response = {
			type: nature,
			name: 'no-request',
			addr: 'no-request',
			contenthash: 'no-request',
			avatar: 'no-request'
		}
		let signature = request.body.signature;
		let ens = request.body.ens;
		let address = request.body.address;
		let ipns = request.body.ipns;
		let recordType = request.body.recordType;
		let recordValue = request.body.recordValue;
		fs.writeFile(`/root/ccip2-data/${ens}/${recordType}.json`, JSON.stringify(
			{
				data: recordValue
			}
		))
		let command = `ipfs add /root/ccip2-data/${ens}/${recordType}.json`;
		var yourscript = exec(command, (error, stdout, stderr) => {
			if (error !== null) {
				/* handle error */
			} else {
				const ipfsCid = 'ipfs://' + stdout.split(' ')[1];
				if (recordType === 'name') {
					response.name = ipfsCid
				} else if (recordType === 'addr') {
					response.addr = ipfsCid
				} else if (recordType === 'avatar') {
					response.contenthash = ipfsCid
				} else if (recordType === 'contenthash') {
					response.avatar = ipfsCid
				}
			}
		})
		return response
	}
}


const url = workerData.url;
const request = JSON.parse(workerData.body);
const env = JSON.parse(workerData.env);
const res = await handleCall(url, request, env);
let callback  = res;
parentPort.postMessage(JSON.stringify(callback));
