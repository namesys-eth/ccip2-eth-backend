import { parentPort, workerData } from "worker_threads";
import { ethers } from "ethers";
import { exec } from "child_process";
import "isomorphic-fetch";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import fs from "fs";
require("dotenv").config();
const { keccak256 } = require("@ethersproject/solidity");
const process = require("process");
const mysql = require("mysql");
const path = require("path");

// Delete directories recursively
function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file, index) => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}

// Safely make directories recursively 'mkdir -p a/b/c' equivalent
function mkdirpSync(directoryPath) {
  const parts = directoryPath.split(path.sep);
  for (let i = 4; i <= parts.length; i++) {
    const currentPath = "/" + path.join(...parts.slice(0, i));
    console.log([iterator, ":", "Checking DIR: ", currentPath]);
    if (!fs.existsSync(currentPath)) {
      console.log([iterator, ":", "Making DIR:  ", currentPath]);
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

function isEmpty(obj) {
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
}

const types = [
  // General
  "addr",
  "contenthash",
  "avatar",
  "pubkey",
  "email",
  "url",
  "description",
  // Socials
  "com.github",
  "com.twitter",
  "com.x",
  "com.discord",
  "xyz.farcaster",
  "nostr",
  // Multi-addr
  "btc",
  "ltc",
  "doge",
  "sol",
  "atom",
  // DNS
  "zonehash",
  // Extradata
  "revision",
  // Stealth
  "stealth",
  "rsa",
];
const files = [
  // General
  "address/60",
  "contenthash",
  "text/avatar",
  "pubkey",
  "text/email",
  "text/url",
  "text/description",
  // Socials
  "text/com.github",
  "text/com.twitter",
  "text/com.x",
  "text/com.discord",
  "text/xyz.farcaster",
  "address/1237",
  // Multi-addr
  "address/0",
  "address/2",
  "address/3",
  "address/501",
  "address/118",
  // DNS
  "dnsrecord/zonehash",
  // Extradata
  "revision",
  // Stealth
  "text/stealth",
  "text/rsa",
];
const EMPTY_STRING = {};
for (const key of types) {
  EMPTY_STRING[key] = "";
}
const EMPTY_BOOL = {};
for (const key of types) {
  EMPTY_BOOL[key] = false;
}

const Launch = "1690120000";
let _Gateway_ = "/var/www/ccip.namesys.xyz";
const FileStore = "/root/ccip2-data";

const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

function logMessage(message) {
  parentPort.postMessage({ type: "log", message: message.join(" ") });
}
console.log = logMessage;

async function handleCall(url, request, iterator) {
  connection.connect((err) => {
    if (err) {
      console.error(
        iterator,
        ":",
        "Error connecting to MySQL database:",
        err.stack
      );
      return;
    }
    console.log([
      iterator,
      ":",
      "Connected to MySQL database as ID:",
      connection.threadId,
    ]);
  });
  //const mainnet = new ethers.providers.AlchemyProvider("homestead", process.env.ALCHEMY_KEY_MAINNET)
  //const goerli = new ethers.providers.AlchemyProvider("goerli", process.env.ALCHEMY_KEY_GOERLI)
  let paths = url.toLowerCase().split("/");
  let nature = paths[paths.length - 1];
  /// GAS
  if (nature === "gas") {
    let response = {
      gas: "0",
    };
    let promises = [];
    let promise = new Promise((resolve, reject) => {
      connection.query(
        `SELECT gas FROM events WHERE timestamp > ${Launch}`,
        function (error, results, fields) {
          if (error) {
            console.error("Error reading gas from database:", error);
            return;
          }
          const _values = results.map((row) => row["gas"]);
          const _sum = _values.reduce((acc, val) => acc + parseFloat(val), 0);
          resolve({
            type: "gas",
            data: _sum.toFixed(4).toString(),
          });
        }
      );
      console.log([iterator, ":", "Closing MySQL Connection"]);
      connection.end();
    });
    promises.push(promise);
    let results = await Promise.all(promises);
    results.forEach((result) => {
      response[result.type] = result.data;
    });
    return JSON.stringify(response);
  }
  /// Remaining calls
  let ens = request.ens;
  let chain = request.chain;
  let caip10 = "eip155-" + chain + "-" + ens;
  let caip10ipns = caip10;
  let controller = request.controller;
  let writePath = ".well-known/" + ens.split(".").reverse().join("/");
  let Gateway = `${_Gateway_}`;
  /// READ
  if (nature === "read") {
    let response = {
      ...EMPTY_STRING,
      type: nature,
      timestamp: { ...EMPTY_STRING },
    };
    let recordsTypes = request.recordsTypes;
    let recordsValues = request.recordsValues;
    let ipns = request.storage.split("ipns://")[1];
    let hashType = request.hashType;
    if (hashType !== "gateway") {
      /// IPNS
      // Get Ownerhash timestamps
      if (ipns) {
        let promises = [];
        let promise = new Promise((resolve, reject) => {
          connection.query(
            `SELECT timestamp FROM events WHERE ipns = 'ipns://${ipns}'`,
            function (error, results, fields) {
              if (error) {
                console.error(
                  "Error reading storage IPNS from database:",
                  error
                );
                return;
              }
              const _values = results.map((row) => row["timestamp"]);
              resolve({
                type: "ownerstamp",
                data: _values || [],
              });
            }
          );
          console.log([iterator, ":", "Closing MySQL Connection"]);
          connection.end();
        });
        promises.push(promise);
        let results = await Promise.all(promises);
        results.forEach((result) => {
          response[result.type] = result.data;
        });
      } else {
        response["ownerstamp"] = [];
      }
      // Update CAIP-10 for Ownerhash
      if (hashType === "ownerhash") {
        caip10ipns = "eip155-" + chain + "-" + controller + "-" + ipns;
      } else if (hashType === "recordhash") {
        caip10ipns = "eip155-" + chain + "-" + ens + "-" + ipns;
      } else {
        caip10ipns = caip10;
      }
      let promises = [];
      if (recordsTypes === "all" && recordsValues === "all") {
        let _files = [...files, "version"];
        let _types = [...types, "version"];
        for (let i = 0; i < _files.length; i++) {
          let _file = "";
          if (["version", "revision"].includes(_types[i])) {
            _file = `${_files[i]}`;
          } else {
            _file = `${writePath}/${_files[i]}`;
          }
          if (fs.existsSync(`${FileStore}/${caip10ipns}/${_file}.json`)) {
            let promise = new Promise((resolve, reject) => {
              fs.readFile(
                `${FileStore}/${caip10ipns}/${_file}.json`,
                function (err, data) {
                  if (err) {
                    reject(err);
                  } else {
                    let cache = JSON.parse(data);
                    resolve({
                      type: _types[i],
                      data:
                        _types[i] === "revision"
                          ? cache.data
                          : _types[i] === "version"
                          ? cache._value || ""
                          : cache.raw,
                      timestamp:
                        _types[i] === "revision"
                          ? cache.sequence
                          : _types[i] === "version"
                          ? cache._validity || ""
                          : cache.timestamp,
                    });
                    cache = {};
                  }
                }
              );
            });
            promises.push(promise);
          } else {
            let promise = new Promise((resolve, reject) => {
              resolve({
                type: _types[i],
                data: "",
                timestamp: "",
              });
            });
            promises.push(promise);
          }
        }
      } else if (recordsTypes !== "all" && recordsValues === "all") {
        for (let i = 0; i < recordsTypes.length; i++) {
          let _file = `${writePath}/${files[types.indexOf(recordsTypes[i])]}`;
          if (fs.existsSync(`${FileStore}/${caip10ipns}/${_file}.json`)) {
            let promise = new Promise((resolve, reject) => {
              fs.readFile(
                `${FileStore}/${caip10ipns}/${_file}.json`,
                function (err, data) {
                  if (err) {
                    reject(err);
                  } else {
                    let cache = JSON.parse(data);
                    resolve({
                      type: recordsTypes[i],
                      data:
                        recordsTypes[i] === "revision"
                          ? cache.data
                          : recordsTypes[i] === "version"
                          ? cache._value || ""
                          : cache.raw,
                      timestamp:
                        recordsTypes[i] === "revision"
                          ? cache.sequence
                          : recordsTypes[i] === "version"
                          ? cache._validity || ""
                          : cache.timestamp,
                    });
                    cache = {};
                  }
                }
              );
            });
            promises.push(promise);
          }
        }
      }
      let results = await Promise.all(promises);
      results.forEach((result) => {
        response[result.type] = result.data;
        response.timestamp[result.type] = result.timestamp;
      });
    } else if (hashType === "gateway") {
      /// GATEWAY
      response["ownerstamp"] = [];
      response["version"] = "";
      response.timestamp["version"] = "";
    }
    return JSON.stringify(response);
    /// WRITE
  } else if (nature === "write") {
    let timestamp = Math.round(Date.now() / 1000);
    let response = {
      ...EMPTY_STRING,
      type: nature,
      ipfs: "",
      ipns: "",
      meta: EMPTY_BOOL,
      timestamp: { ...EMPTY_STRING },
    };
    let ipns = request.ipns;
    let recordsTypes = request.recordsTypes;
    let recordsValues = request.recordsValues;
    let recordsRaw = request.recordsRaw;
    let signatures = request.signatures;
    let manager = request.manager;
    let managerSig = request.managerSignature;
    let promises = [];
    let recordsFiles = [...recordsTypes];
    let hashType = request.hashType;
    if (hashType !== "gateway") {
      /// IPNS
      // Update CAIP-10 for Ownerhash
      if (hashType === "ownerhash") {
        caip10ipns = "eip155-" + chain + "-" + controller + "-" + ipns;
      } else if (hashType === "recordhash") {
        caip10ipns = "eip155-" + chain + "-" + ens + "-" + ipns;
      } else {
        caip10ipns = caip10;
      }
      // Read from previous version
      let _storage = {};
      if (fs.existsSync(`${FileStore}/${caip10ipns}/revision.json`)) {
        let promises = [];
        let promise = new Promise((resolve, reject) => {
          fs.readFile(
            `${FileStore}/${caip10ipns}/revision.json`,
            function (err, data) {
              if (err) {
                reject(err);
              } else {
                let cache = JSON.parse(data);
                resolve({
                  type: "ipns",
                  data: cache.ipns,
                });
                cache = {};
              }
            }
          );
        });
        promises.push(promise);
        let _results = await Promise.all(promises);
        _results.forEach((_result) => {
          _storage[_result.type] = _result.data;
        });
      } else {
        _storage["ipns"] = ipns;
      }
      // Handle history
      if (_storage["ipns"] !== ipns) {
        console.log([
          iterator,
          ":",
          "New IPNS for exisiting ENS:",
          `${FileStore}/${caip10ipns}`,
        ]);
        //deleteFolderRecursive()
      }
      for (let i = 0; i < recordsTypes.length; i++) {
        // Set filenames for non-standard records
        recordsFiles[i] = files[types.indexOf(recordsTypes[i])];
        let promise = new Promise((resolve, reject) => {
          // Make strict directory structure for TYPES[]
          let repo = `${FileStore}/${caip10ipns}/${writePath}/`;
          if (!fs.existsSync(repo)) {
            mkdirpSync(repo); // Make repo if it doesn't exist
          }
          // Make further sub-directories when needed in FILES[]
          let subRepo = path.dirname(
            `${FileStore}/${caip10ipns}/${writePath}/${recordsFiles[i]}.json`
          );
          if (!fs.existsSync(subRepo)) {
            if (recordsFiles[i].includes("/")) {
              mkdirpSync(subRepo); // Make repo 'parent/child' if it doesn't exist
            } else {
              fs.mkdirSync(subRepo);
            }
          }
          // Write record
          fs.writeFile(
            `${FileStore}/${caip10ipns}/${writePath}/${recordsFiles[i]}.json`,
            JSON.stringify({
              domain: ens,
              data: recordsValues[recordsTypes[i]],
              raw: recordsRaw[recordsTypes[i]],
              timestamp: timestamp,
              signer: manager,
              controller: controller,
              managerSignature: managerSig,
              recordSignature: signatures[recordsTypes[i]],
            }),
            (err) => {
              if (err) {
                console.log([
                  iterator,
                  ":",
                  "Fatal Error During Record Writing:",
                  err,
                ]);
                reject(err);
              } else {
                response.meta[recordsTypes[i]] = true;
                response[recordsTypes[i]] = recordsRaw[recordsTypes[i]];
                response.timestamp[recordsTypes[i]] = timestamp;
                console.log([
                  iterator,
                  ":",
                  "Successfully Wrote Record:",
                  `${recordsFiles[i]}`,
                ]);
                resolve();
              }
            }
          );
        });
        promises.push(promise);
      }
      await Promise.all([promises]);
      let command = `ipfs add -r --hidden ${FileStore}/${caip10ipns}`;
      let ipfsCid;
      let pinIpfs = new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error !== null) {
            console.log([
              iterator,
              ":",
              "Fatal Error During IPFS Pinning (411):",
              stderr,
            ]);
            reject(error);
          } else {
            const lines = stdout.trim().split("\n");
            const secondLastLine = lines[lines.length - 1];
            ipfsCid = secondLastLine.split(" ")[1];
            response.ipfs = "ipfs://" + ipfsCid;
            resolve();
          }
        });
      });
      await Promise.all([pinIpfs]);
      let pinIpns = new Promise((resolve, reject) => {
        let pinCmd = `ipfs pin add ${ipfsCid}`;
        exec(pinCmd, (error, stdout, stderr) => {
          if (error !== null) {
            console.log([
              iterator,
              ":",
              "Fatal Error During IPFS Pinning (412):",
              stderr,
            ]);
            reject(error);
          } else {
            //console.log(iterator, ':', 'IPFS Daemon Says:', stdout)
            response.ipns = "ipns://" + ipns;
            console.log([
              iterator,
              ":",
              `Recursively Pinned: ipfs://${ipfsCid}`,
            ]);
            console.log([iterator, ":", "Making Database Entry..."]);
            connection.query(
              "INSERT INTO events (ens, timestamp, ipfs, ipns, revision, gas, meta) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [
                caip10,
                timestamp,
                response.ipfs,
                response.ipns,
                "0x0",
                "0",
                JSON.stringify(response.meta),
              ],
              (error, results, fields) => {
                if (error) {
                  console.error("Error executing database entry:", error);
                }
                resolve();
              }
            );
            //console.log(iterator, ':', 'Closing MySQL Connection')
            //connection.end()
          }
        });
      });
      await Promise.all([pinIpns]);
    } else if (hashType === "gateway") {
      /// GATEWAY
      let gate_ = `${Gateway}/${writePath}/`;
      let _gate = `${Gateway}/${chain}/${writePath}/`;
      if (!fs.existsSync(gate_) && chain === "1") {
        mkdirpSync(gate_);
      } else if (!fs.existsSync(_gate) && chain === "5") {
        mkdirpSync(_gate);
      }
      for (let i = 0; i < recordsTypes.length; i++) {
        // Set filenames for non-standard records
        recordsFiles[i] = files[types.indexOf(recordsTypes[i])];
        let promise = new Promise((resolve, reject) => {
          let subGate_ = path.dirname(
            `${Gateway}/${writePath}/${recordsFiles[i]}.json`
          );
          let _subGate = path.dirname(
            `${Gateway}/${chain}/${writePath}/${recordsFiles[i]}.json`
          );
          if (!fs.existsSync(subGate_) && chain === "1") {
            if (recordsFiles[i].includes("/")) {
              mkdirpSync(subGate_);
            } else {
              fs.mkdirSync(subGate_);
            }
          } else if (!fs.existsSync(_subGate) && chain === "5") {
            if (recordsFiles[i].includes("/")) {
              mkdirpSync(_subGate);
            } else {
              fs.mkdirSync(_subGate);
            }
          }
          // Write to Gateway
          let _gateway = "";
          if (chain === "1") {
            _gateway = `${Gateway}/${writePath}/${recordsFiles[i]}.json`;
          } else if (chain === "5") {
            _gateway = `${Gateway}/${chain}/${writePath}/${recordsFiles[i]}.json`;
          }
          fs.writeFile(
            _gateway,
            JSON.stringify({
              domain: ens,
              data: recordsValues[recordsTypes[i]],
              raw: recordsRaw[recordsTypes[i]],
              timestamp: timestamp,
              signer: manager,
              controller: controller,
              managerSignature: managerSig,
              recordSignature: signatures[recordsTypes[i]],
            }),
            (err) => {
              if (err) {
                console.log([
                  iterator,
                  ":",
                  "Fatal Error During Gateway Write:",
                  err,
                ]);
                reject(err);
              } else {
                response.meta[recordsTypes[i]] = true;
                response[recordsTypes[i]] = recordsRaw[recordsTypes[i]];
                response.timestamp[recordsTypes[i]] = timestamp;
                console.log([
                  iterator,
                  ":",
                  "Successfully Wrote To Gateway:",
                  `${recordsFiles[i]}`,
                ]);
                resolve();
              }
            }
          );
        });
        promises.push(promise);
      }
      await Promise.all([promises]);
      let dbEntry = new Promise((resolve, reject) => {
        connection.query(
          "INSERT INTO events (ens, timestamp, ipfs, ipns, revision, gas, meta) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            caip10,
            timestamp,
            "0x0",
            "0x0",
            "0x0",
            "0",
            JSON.stringify(response.meta),
          ],
          (error, results, fields) => {
            if (error) {
              console.error("Error executing database entry:", error);
            }
            resolve();
          }
        );
      });
      await Promise.all([dbEntry]);
    }
    return JSON.stringify(response);
    /// REVISION
  } else if (nature === "revision") {
    let response = {
      status: false,
    };
    let ipns = request.ipns;
    let ipfs = request.ipfs;
    let revision = request.revision;
    let version = JSON.parse(request.version.replace("\\", ""));
    let gas = JSON.parse(request.gas);
    let manager = request.manager;
    let managerSig = request.managerSignature;
    let hashType = request.hashType;
    if (hashType !== "gateway" && ipfs) {
      // Update CAIP-10 for Ownerhash
      if (hashType === "ownerhash") {
        caip10ipns = "eip155-" + chain + "-" + controller + "-" + ipns;
      } else if (hashType === "recordhash") {
        caip10ipns = "eip155-" + chain + "-" + ens + "-" + ipns;
      } else {
        caip10ipns = caip10;
      }
      // Read from previous version
      let _sequence = {};
      if (fs.existsSync(`${FileStore}/${caip10ipns}/revision.json`)) {
        let promises = [];
        let promise = new Promise((resolve, reject) => {
          fs.readFile(
            `${FileStore}/${caip10ipns}/revision.json`,
            function (err, data) {
              if (err) {
                reject(err);
              } else {
                let cache = JSON.parse(data);
                resolve({
                  type: "sequence",
                  data: cache.sequence,
                });
                cache = {};
              }
            }
          );
        });
        promises.push(promise);
        let _results = await Promise.all(promises);
        _results.forEach((_result) => {
          _sequence[_result.type] = _result.data
            ? String(Number(_result.data) + 1)
            : "0";
        });
      } else {
        _sequence["sequence"] = "0";
      }
      let promise = new Promise((resolve, reject) => {
        // Decoded version metadata utilised by NameSys
        [`${FileStore}/${caip10ipns}`].forEach((filestore) => {
          fs.writeFile(
            `${filestore}/revision.json`,
            JSON.stringify({
              domain: ens,
              data: revision,
              timestamp: request.timestamp,
              signer: manager,
              controller: controller,
              managerSignature: managerSig,
              ipns: ipns,
              ipfs: ipfs,
              sequence: _sequence.sequence,
              gas: sumValues(gas).toPrecision(3),
            }),
            (err) => {
              if (err) {
                reject(err);
              } else {
                console.log([iterator, ":", "Making Database Revision..."]);
                let _revision = new Uint8Array(
                  Object.values(revision)
                ).toString("utf-8");
                // Update DB
                connection.query(
                  `UPDATE events SET revision = ?, gas = ? WHERE ens = ? AND revision = '0x0' AND gas = '0'`,
                  [
                    _revision,
                    chain === "1"
                      ? sumValues(gas).toPrecision(3).toString()
                      : "0.000",
                    caip10,
                  ],
                  (error, results, fields) => {
                    if (error) {
                      console.error(
                        "Error executing database revision:",
                        error
                      );
                    }
                  }
                );
                console.log([iterator, ":", "Closing MySQL Connection"]);
                connection.end();
              }
            }
          );
          // Encoded version metadata required by W3Name to republish IPNS records
          fs.writeFile(
            `${filestore}/version.json`,
            JSON.stringify(version),
            (err) => {
              if (err) {
                reject(err);
              } else {
                console.log([iterator, ":", "Making Version File..."]);
                response.status = true;
                resolve();
              }
            }
          );
        });
      });
      await Promise.all([promise]);
    } else if (hashType === "gateway" && request.timestamp && !isEmpty(gas)) {
      // Revision file
      let revFile_ = `${Gateway}/${writePath}/revision.json`;
      let _revFile = `${Gateway}/${chain}/${writePath}/revision.json`;
      let _sequence = {};
      if (fs.existsSync(chain === "1" ? revFile_ : _revFile)) {
        let promises = [];
        let promise = new Promise((resolve, reject) => {
          fs.readFile(
            chain === "1" ? revFile_ : _revFile,
            function (err, data) {
              if (err) {
                reject(err);
              } else {
                let cache = JSON.parse(data);
                resolve({
                  type: "sequence",
                  data: cache.sequence,
                });
                cache = {};
              }
            }
          );
        });
        promises.push(promise);
        let _results = await Promise.all(promises);
        _results.forEach((_result) => {
          _sequence[_result.type] = _result.data
            ? String(Number(_result.data) + 1)
            : "0";
        });
      } else {
        _sequence["sequence"] = "0";
      }
      // Update DB
      console.log([iterator, ":", "Updating Database..."]);
      connection.query(
        `UPDATE events SET revision = ?, gas = ? WHERE ens = ? AND revision = '0x0' AND gas = '0'`,
        [
          "0x0",
          chain === "1" ? sumValues(gas).toPrecision(3).toString() : "0.000",
          caip10,
        ],
        (error, results, fields) => {
          if (error) {
            console.error("Error executing database update:", error);
          }
        }
      );
      // Write update
      let promises = [];
      let promise = new Promise((resolve, reject) => {
        fs.writeFile(
          chain === "1" ? revFile_ : _revFile,
          JSON.stringify({
            domain: ens,
            data: revision,
            timestamp: request.timestamp,
            signer: manager,
            controller: controller,
            managerSignature: managerSig,
            ipns: ipns,
            ipfs: ipfs,
            sequence: _sequence.sequence,
            gas: chain === "1" ? sumValues(gas).toPrecision(3) : "0.000",
          }),
          (err) => {
            if (err) {
              reject(err);
            } else {
              console.log([iterator, ":", "Making Revision File..."]);
              response.status = true;
              resolve();
            }
          }
        );
      });
      promises.push(promise);
      await Promise.all(promises);
    } else if (
      ["ownerhash", "recordhash"].includes(hashType) &&
      !request.timestamp &&
      isEmpty(gas)
    ) {
      console.log([
        iterator,
        ":",
        "New IPNS for exisiting ENS:",
        `${FileStore}/${caip10ipns}`,
      ]);
      //deleteFolderRecursive()
    }
    return JSON.stringify(response);
  }
}

const url = workerData.url;
const request = JSON.parse(workerData.body);
const iterator = JSON.parse(workerData.iterator);
const res = await handleCall(url, request, iterator);
let callback = res;
parentPort.postMessage(callback);
