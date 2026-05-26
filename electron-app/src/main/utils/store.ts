import Store from 'electron-store'

const store = new Store({
  defaults: {
    theme: 'system',
    autoStart: false,
    aiChatPosition: 'right',
    backendUrl: 'http://100.70.198.102:8000',
    deepseekModel: 'deepseek-v4-flash'
  }
})

export { store }
