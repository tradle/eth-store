const ethUtil = require('ethereumjs-util')
const debug = require('debug')('tradle:eth-store:query')

class EthQuery {
  constructor (provider) {
    this.currentProvider = provider
  }

  async getAccount (address, block) {
    const [balance, nonce, code] = await Promise.all([
      this.getBalance(address, block),
      this.getNonce(address, block),
      this.getCode(address, block)
    ])
    return { balance, nonce, code }
  }

  async getBlockByHashWithUncles (blockHash) {
    const block = await this.getBlockByHash(blockHash)
    if (!block) return null
    const count = block.uncles.length
    block.uncles = await times(
      count,
      index => this.getUncleByBlockHashAndIndex(block.hash, ethUtil.intToHex(index))
    )
    return block
  }

  async getBlockByNumberWithUncles (blockNumber) {
    const block = await this.getBlockByNumber(blockNumber)
    if (!block) return null

    const count = block.uncles.length
    block.uncles = await times(
      count,
      index => this.getUncleByBlockHashAndIndex(block.hash, ethUtil.intToHex(index))
    )
    return block
  }

  async getLatestBlockNumber () {
    return (await this.getLatestBlock()).number
  }

  async getLatestBlock () {
    return await this.getBlockByNumber('latest')
  }

  // rpc level
  async getBlockByNumber (blockNumber) {
    return this.sendAsync({
      method: 'eth_getBlockByNumber',
      params: [toHex(blockNumber), true]
    })
  }

  async getBlockByHash (blockHash) {
    return this.sendAsync({
      method: 'eth_getBlockByHash',
      params: [blockHash, true]
    })
  }

  async getUncleCountByBlockHash (blockHash) {
    return this.sendAsync({
      method: 'eth_getUncleCountByBlockHash',
      params: [blockHash]
    })
  }

  async getUncleByBlockHashAndIndex (blockHash, index) {
    return this.sendAsync({
      method: 'eth_getUncleByBlockHashAndIndex',
      params: [blockHash, toHex(index)]
    })
  }

  async getTransaction (txHash) {
    return this.sendAsync({
      method: 'eth_getTransactionByHash',
      params: [txHash]
    })
  }

  async getBalance (address, block) {
    return this.sendAsync({
      method: 'eth_getBalance',
      params: [address, toHex(block)]
    })
  }

  async getNonce (address, block) {
    return this.sendAsync({
      method: 'eth_getTransactionCount',
      params: [address, toHex(block)]
    })
  }

  async getCode (address, block) {
    return this.sendAsync({
      method: 'eth_getCode',
      params: [address, toHex(block)]
    })
  }

  // network level
  async sendAsync (opts) {
    const payload = createPayload(opts)
    debug('request', payload.id, payload)
    let response
    if (typeof this.currentProvider.sendPromise === 'function') {
      response = await this.currentProvider.sendPromise(payload)
    } else {
      response = await new Promise((resolve, reject) => {
        this.currentProvider.sendAsync(payload, (err, result) => {
          if (err) {
            debug('error', payload.id, err)
            reject(err)
          } else {
            resolve(result)
          }
        })
      })
    }
    debug('response', payload.id, response)

    if (response.error) {
      throw new Error(response.error)
    }

    return response.result
  }
}

function times (count, mapper) {
  const result = []
  for (let i = 0; i < count; i++) {
    result[i] = mapper(i)
  }
  return Promise.all(result)
}

// util

let lastMs = 0
let lastI = 0

function createPayload (data) {
  return {
    // defaults
    id: createID(),
    jsonrpc: '2.0',
    params: [],
    // user-specified
    ...data
  }
}

function createID () {
  const now = Date.now().toString()
  if (now !== lastMs) {
    lastMs = now
    lastI = 0
  } else {
    lastI += 1
    if (lastI >= 1000) {
      throw new Error('Too many requests per millisecond. Only 1000 requests per ms supported')
    }
  }
  return now + lastI.toString().padStart(3, '0')
}

function toHex (input) {
  if (typeof input === 'number') {
    return ethUtil.intToHex(input)
  }
  return input
}

EthQuery.createID = createID
EthQuery.createPayload = createPayload
module.exports = EthQuery
