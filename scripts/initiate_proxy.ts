import { Account, Pallets, SDK } from "avail-js-sdk"

async function main() {
    console.log("\n\n\n👾 Starting proxy initiation...\n")
    
    const sdk = await SDK.New(SDK.turingEndpoint)

    const proxyAccount = Account.bob()
    const mainAccount = Account.ferdie()

    const balance_extrinsic = sdk.tx.balances.transferKeepAlive(proxyAccount.address, SDK.oneAvail())
    const proxy_tx = sdk.tx.proxy.proxy(mainAccount.address, null, balance_extrinsic.tx)

    const callHash = proxy_tx.tx.method.hash.toString()
    const callData = proxy_tx.tx.unwrap().toHex()
    const maxWeight = (await proxy_tx.paymentQueryCallInfo()).weight

    console.log(`Call hash: ${callHash}`)
    console.log(`Call data: ${callData}`)
    console.log(`Max weight: ${maxWeight}`)

    const tx = sdk.tx.multisig.approveAsMulti(3, [], null, callHash, maxWeight)
    const res = await tx.executeWaitForInclusion(mainAccount, {})

    const event = res.events?.findFirst(Pallets.MultisigEvents.NewMultisig)
    if (event == undefined) throw Error()
    console.log(
      `Approving: ${event.approving.toSS58()}, Multisig: ${event.multisig.toSS58()}, Call Hash: ${event.callHash.toHex()}`,
    )

}

main()