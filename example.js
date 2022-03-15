const debug = require('debug')('example')
if (!debug.enabled) {
  console.log('[NOTE] this may take a while, with DEBUG=* you can figure out what is happening.\n---')
}

const EthStore = require('./index')
const ZeroClient = require('@tradle/web3-provider-engine/zero')

const projectId = process.env.INFURA_PROJECT_ID

const rpcUrl = projectId ? `https://mainnet.infura.io/v3/${projectId}` : 'http://127.0.0.1:3334'

console.log(`Starting zero client for RPC ${rpcUrl} endpoint\n---`)
const engine = ZeroClient({
  rpcUrl
})

const store = new EthStore(engine, engine)

store.put('myBalance', {
  method: 'eth_getBalance',
  params: ['0x86ccA572d34400ce20e7a44Fb970496ABA221253', 'latest']
})

store.on('warn', err => {
  if (/ECONNREFUSED/.test(err.message)) {
    console.log(`

[ERROR] Can not find a local geth node. Maybe you need to start one?!
  Recommended mode:
  $ geth --http --http.port 3334 --cache.noprefetch --syncmode light

[NOTE] You can also start this example with an INFURA_PROJECT_ID to use infura API servers.
`)
    engine.stop()
    return
  }
  console.warn(err, err.code, err.statusCode, err.httpStatus)
  if (/no suitable peers available/.test((err.data || {}).message)) {
    console.log('[HINT] Maybe your node is still starting up?')
  }
})

store.once('block', block => {
  console.log({ block })
  engine.stop()
})
