import { ConnectorUpdate } from '@web3-react/types'
import { AbstractConnector } from '@web3-react/abstract-connector'
import { LedgerConnectKit, loadConnectKit, SupportedProviders } from '@ledgerhq/connect-kit-loader'

export class NoEthereumProviderError extends Error {
  public constructor() {
    super()
    this.name = this.constructor.name
    this.message = 'No Ethereum provider was found on window.ethereum.'
  }
}

export type SendReturnResult = { result: any }
export type SendReturn = any
export type Send = (method: string, params?: any[]) => Promise<SendReturnResult | SendReturn>

interface LedgerConnectorArguments {
  chainId: number
  url: string
  pollingInterval?: number
  requestTimeoutMs?: number
  accountFetchingConfigs?: any
  baseDerivationPath?: string
}

export class LedgerConnector extends AbstractConnector {
  private readonly chainId: number

  private provider: any
  private connectKit: Promise<LedgerConnectKit>

  constructor({ chainId }: LedgerConnectorArguments) {
    super({ supportedChainIds: [chainId] })

    this.connectKit = loadConnectKit()

    this.chainId = chainId

    this.handleNetworkChanged = this.handleNetworkChanged.bind(this)
    this.handleChainChanged = this.handleChainChanged.bind(this)
    this.handleAccountsChanged = this.handleAccountsChanged.bind(this)
    this.handleClose = this.handleClose.bind(this)
  }

  private handleChainChanged(chainId: string | number): void {
    if (__DEV__) {
      console.log("Handling 'chainChanged' event with payload", chainId)
    }
    this.emitUpdate({ chainId, provider: this.provider })
  }

  private handleAccountsChanged(accounts: string[]): void {
    if (__DEV__) {
      console.log("Handling 'accountsChanged' event with payload", accounts)
    }
    if (accounts.length === 0) {
      this.emitDeactivate()
    } else {
      this.emitUpdate({ account: accounts[0] })
    }
  }

  private handleClose(code: number, reason: string): void {
    if (__DEV__) {
      console.log("Handling 'close' event with payload", code, reason)
    }
    this.emitDeactivate()
  }

  private handleNetworkChanged(networkId: string | number): void {
    if (__DEV__) {
      console.log("Handling 'networkChanged' event with payload", networkId)
    }
    this.emitUpdate({ chainId: networkId, provider: this.provider })
  }

  public async activate(): Promise<ConnectorUpdate> {
    if (!this.provider) {
      // load Connect Kit, check support and show a UI modal if not supported
      const connectKit = await this.connectKit
      const checkSupport = connectKit.checkSupport()
      console.log(checkSupport)

      if (checkSupport.isLedgerConnectEnabled && !checkSupport.error) {
        // Connect is supported and no error was triggered, we can access the
        // provider injected by Connect
        this.provider = connectKit.getProvider(SupportedProviders.ethereum)

        if (this.provider.on) {
          this.provider.on('chainChanged', this.handleChainChanged)
          this.provider.on('accountsChanged', this.handleAccountsChanged)
          this.provider.on('close', this.handleClose)
          this.provider.on('networkChanged', this.handleNetworkChanged)
        }
      } else if (!!checkSupport?.error) {
        // if an error was triggered show it
        throw checkSupport.error
      }
    }

    return { provider: this.provider, chainId: this.chainId }
  }

  public async getProvider(): Promise<any> {
    return this.provider
  }

  public async getChainId(): Promise<number> {
    return this.chainId
  }

  public async getAccount(): Promise<null> {
    if (!this.provider) {
      throw new NoEthereumProviderError()
    }

    let account
    try {
      account = this.provider.request({ method: 'eth_accounts' }).then((accounts: any) => {
        return accounts[0]
      })
    } catch {
      console.error('eth_accounts was unsuccessful')
    }

    return account
  }

  public deactivate() {
    if (this.provider && this.provider.removeListener) {
      this.provider.removeListener('chainChanged', this.handleChainChanged)
      this.provider.removeListener('accountsChanged', this.handleAccountsChanged)
      this.provider.removeListener('close', this.handleClose)
      this.provider.removeListener('networkChanged', this.handleNetworkChanged)
    }
  }
}
