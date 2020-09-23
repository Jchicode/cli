import axios from 'axios'
import moment from 'moment'

const getBlockTemplate = (header, txsData) => ({
  height: header.height,
  header,
  txs: txsData.txs ? txsData.txs : 0,
  blockMeta: null,
  txsDecoded: []
})

export default {
  /**
   * 
   * 
   * @param {string} rpcUrl
   * @param {string|number} blockHeight
   * @param {function} errCallback
   *
   *  
   */      
  async fetchBlockMeta(rpcUrl, blockHeight, errCallback) {
    try {
      return await axios.get(`http://${rpcUrl}/block?height=${blockHeight}`)
    } catch (err) {
      console.error(err)
      errCallback(err)
    }
  },
  /**
   * 
   * 
   * @param {string} rpcUrl
   * @param {string|number} maxBlockHeight
   * @param {number} [maxEntriesCount=20]
   * @param {function} errCallback
   *
   *  
   */      
  async fetchBlockchain(rpcUrl, maxBlockHeight, maxEntriesCount=20, errCallback) {
    const fmtMinHeight = maxBlockHeight - maxEntriesCount >= 0 
      ? maxBlockHeight - maxEntriesCount
      : 0
    try {
      return await axios.get(`http://${rpcUrl}/blockchain?minHeight=${fmtMinHeight}&maxHeight=${maxBlockHeight}`)
    } catch (err) {
      console.error(err)
      if (errCallback) errCallback(err)
    }
  },
  /**
   * 
   * 
   * @param {string} lcdUrl
   * @param {string} txEncoded
   * @param {function} errCallback
   *
   *  
   */      
  async fetchDecodedTx(lcdUrl, txEncoded, errCallback) {
    try {
      return await axios.post(`http://${lcdUrl}/txs/decode`, { tx: txEncoded }) 
    } catch (err) {
      console.error(txEncoded, err)
      errCallback(txEncoded, err)
    }        
  },   
  blockFormatter() {
    return {
      /**
       * 
       * 
       * @param {object} header
       * @param {object} txsData
       * TODO: define shape
       *
       *  
       */            
      setNewBlock(header, txsData) {
          const blockTemplate = getBlockTemplate(header, txsData)
          /**
           * 
           * 
           * @param {object} msg
           * TODO: define shape
           *
           *  
           */              
          const setBlockMeta = (msg) => {
            blockTemplate.blockMeta = msg.data?.result ? msg.data.result : msg
          }
          /**
           * 
           * 
           * @param {object} tx
           * TODO: define shape
           *
           *  
           */                        
          const setBlockTxsDecoded = (tx) => {
            blockTemplate.txsDecoded.push(tx.data.result)
          }
          /**
           * 
           * 
           * @param {function} fetchDecodedTx
           * TODO: define shape
           *
           *  
           */               
          const setBlockTxs = (fetchDecodedTx, lcdUrl, txErrCallback) => {
            if (txsData.txs && txsData.txs.length > 0) {
              const txsDecoded = txsData.txs
                .map(txEncoded => fetchDecodedTx(lcdUrl, txEncoded, txErrCallback))
              
              txsDecoded.forEach(txRes => txRes.then(txResolved => {
                setBlockTxsDecoded(txResolved)
              }))
            }                
          }

          return {
            block: blockTemplate,
            setBlockMeta,
            setBlockTxsDecoded,
            setBlockTxs
          }
      },
      /**
       * 
       * 
       * @param {array} blockEntries
       * TODO: define shape of block object
       * 
       * 
       */    
      blockForTable(blockEntries) {
        if (blockEntries.length > 0) {
          return blockEntries.map((block) => {
            const {
              time,
              height,
              proposer_address,
            } = block.header

            const {
              hash
            } = block.blockMeta.block_id

            return {
              blockMsg: {
                time_formatted: moment(time).fromNow(true),
                time: time,
                height,
                proposer: `${proposer_address.slice(0,10)}...`,
                blockHash_sliced: `${hash.slice(0,30)}...`,
                blockHash: hash,
                txs: block.txs ? block.txs.length : 0          
              },
              tableData: {
                id: height,
                isActive: false
              },
              txs: block.txsDecoded
            }          
          })        
        }
      },
      /**
       * 
       * 
       * @param {array} txs
       * TODO: define shape of block object
       * 
       * 
       */    
      txForCard(txs, chainId) {
        return txs.map(tx => {
          const {
            fee,
            memo,
            msg,            
            signatures
          } = tx
  
          return {
            meta: this.txMeta({ fee, memo }),
            msgs: msg.map(msg => this.txMsg(msg, chainId)),
            tableData: {
              id: tx.signatures[0].signature, // temp
              isActive: false
            },
          }
        })
      },      
      /**
       * 
       * 
       * @param {object} metaData
       * @param {string} metaData[].fee
       * @param {string} metaData[].memo
       * TODO: define shape of block object
       * 
       * 
       */                
      txMeta({fee, memo}) {
        return {
          'Fee': fee.amount[0] ? fee.amount[0].amount : 'N/A', // temp
          'Gas': fee.gas, // temp
          'Memo': memo && memo.length>0 ? memo : 'N/A'          
        }
      },
      /**
       * @param {object} msg
       * @param {string} msg[].type
       * @param {object} msg[].value
       * @param {string} chainId
       * TODO: define shape of block object
       */                
      txMsg({ type, value }, chainId) {
        function fmtMsgKey(msgKey) {
          return msgKey.charAt(0).toUpperCase() + msgKey.slice(1)
        }

        const msgHolder = {
          type: this.getMsgType(type, chainId)
        }
        for (const [key, msg] of Object.entries(value)) {
          msgHolder[fmtMsgKey(key)] = msg
        }

        return msgHolder
      },
      /**
       * 
       * 
       * @param {array} blockEntries
       * TODO: define shape of block object
       * 
       * 
       */          
      filterBlock(blockEntries) {
        const hideBlocksWithoutTxs = () => {
          return blockEntries.filter(block => block.txs && block.txs.length > 0)
        }

        return {
          hideBlocksWithoutTxs
        }
      },
      /**
       * 
       * 
       * @param {object} amountObj
       * TODO: define shape of amount object
       * 
       * 
       */             
      getAmount(amountObj) {
        return amountObj.amount 
          ? amountObj.amount+amountObj.denom
          : amountObj[0].amount+amountObj[0].denom
      },
      /**
       * 
       * 
       * @param {string} type
       * @param {string} prefix
       * 
       * 
       */             
      getMsgType(type, prefix) {
        return type.replace(prefix+'/', '')
      }      
    }
  }
}