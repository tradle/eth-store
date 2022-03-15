/*

some design questions

- should we commit state immediately?
- should we emit events per key?

*/
const { EventEmitter } = require('events')
const debug = require('debug')('tradle:eth-store')
const clone = require('clone')
const EthQuery = require('./query')

module.exports = class EthereumStore extends EventEmitter {
  constructor (blockTracker, provider) {
    super()
    this._subscriptions = {}
    this._currentState = {}
    this._provider = provider
    this.query = (new EthQuery(provider))
    const _onBlock = block => {
      this._updateForBlock(block).catch(err => {
        debug('Error while updating block', err)
        this.emit('warn', err)
      })
    }
    blockTracker.on('block', _onBlock)
    const _onError = error => {
      this.emit('warn', error)
    }
    blockTracker.on('error', _onError)
    this.destroy = () => {
      blockTracker.off('block', _onBlock)
      blockTracker.off('error', _onError)
    }
  }

  //
  // public
  //

  getState () {
    return clone(this._currentState)
  }

  get (key) {
    return this._currentState[key]
  }

  put (key, payload) {
    this._subscriptions[key] = payload
    this._currentState[key] = undefined
    this.emit('update', this.getState())
    this._makeRequest(key, payload).catch(err => {
      debug('Error putting block', err)
      this.emit('warn', err)
    })
  }

  del (key) {
    delete this._subscriptions[key]
    delete this._currentState[key]
    this.emit('update', this.getState())
  }

  //
  // private
  //

  async _updateForBlock (block) {
    // TODO: never run more than one _updateForBlock at a time
    const blockNumber = '0x' + block.number.toString('hex')
    this.currentBlockNumber = blockNumber

    await Promise.all(
      Object.entries(this._subscriptions)
        .filter(([_key, payload]) => Boolean(payload))
        .map(([key, payload]) => this._makeRequest(key, payload))
    )
    // this._currentState = newState
    this.emit('block', this.getState())
  }

  // TODO: should lock to specified block
  async _makeRequest (key, payload) {
    debug('making request for', key, payload)
    const result = await this.query.sendAsync(payload)
    debug('result for', key, payload, result)
    this._currentState[key] = result
    return result
  }
}
