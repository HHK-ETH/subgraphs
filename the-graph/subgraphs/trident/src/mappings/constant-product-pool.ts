import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import {
  Approval,
  Burn as BurnEvent,
  Mint as MintEvent,
  Swap as SwapEvent,
  Sync,
  Transfer,
} from '../../generated/templates/ConstantProductPool/ConstantProductPool'
import { Burn, Mint, Swap, TokenDaySnapshot, TokenPrice } from '../../generated/schema'
import {
  getConstantProductPoolKpi,
  getOrCreateConstantProductPoolFactory,
  getOrCreateToken,
  getTokenKpi,
  getOrCreateTransaction,
  getConstantProductPoolAsset,
  getOrCreateTokenPrice,
  getRebase,
  getTokenPrice,
  getNativeTokenPrice,
  toAmount,
  updateTokenDaySnapshot,
  updatePoolDaySnapshot,
  updatePoolHourSnapshot,
} from '../functions'

import { ADDRESS_ZERO, STABLE_POOL_ADDRESSES, NATIVE_ADDRESS } from '../constants/addresses'
import { updateTokenPrice } from '../modules/pricing'

export function onMint(event: MintEvent): void {
  log.debug('[ConstantProduct] onMint...', [])

  const factory = getOrCreateConstantProductPoolFactory()
  factory.transactionCount = factory.transactionCount.plus(BigInt.fromI32(1))

  const poolAddress = event.address.toHex()

  const poolKpi = getConstantProductPoolKpi(poolAddress)

  const asset0 = getConstantProductPoolAsset(poolAddress.concat(':asset:0'))

  const asset1 = getConstantProductPoolAsset(poolAddress.concat(':asset:1'))

  const token0 = getOrCreateToken(asset0.token)

  const amount0 = event.params.amount0.divDecimal(
    BigInt.fromI32(10)
      .pow(token0.decimals.toI32() as u8)
      .toBigDecimal()
  )

  const token0Kpi = getTokenKpi(asset0.token)
  token0Kpi.liquidity = token0Kpi.liquidity.plus(amount0)
  token0Kpi.transactionCount = token0Kpi.transactionCount.plus(BigInt.fromI32(1))

  const token1 = getOrCreateToken(asset1.token)

  const amount1 = event.params.amount1.divDecimal(
    BigInt.fromI32(10)
      .pow(token1.decimals.toI32() as u8)
      .toBigDecimal()
  )

  const token1Kpi = getTokenKpi(asset1.token)
  token1Kpi.liquidity = token1Kpi.liquidity.plus(amount1)
  token1Kpi.transactionCount = token1Kpi.transactionCount.plus(BigInt.fromI32(1))

  const liquidity = event.params.liquidity.divDecimal(BigInt.fromI32(10).pow(18).toBigDecimal())

  poolKpi.liquidity = poolKpi.liquidity.plus(liquidity)

  const transaction = getOrCreateTransaction(event)

  const mint = new Mint('constant-product:' + transaction.id.toString() + ':' + poolKpi.transactionCount.toString())

  mint.transaction = transaction.id
  mint.pool = poolAddress
  mint.token0 = asset0.token
  mint.token1 = asset1.token
  mint.amount0 = amount0
  mint.amount1 = amount1
  mint.recipient = event.params.recipient
  mint.sender = event.params.sender
  mint.sender = event.params.sender
  mint.origin = event.transaction.from

  mint.logIndex = event.logIndex

  poolKpi.transactionCount = poolKpi.transactionCount.plus(BigInt.fromI32(1))
  poolKpi.save()

  factory.save()
  token0.save()
  token1.save()
  mint.save()

  // update the LP position
  // let liquidityPosition = createLiquidityPosition(event.address, mint.to as Address)
  // createLiquiditySnapshot(liquidityPosition, event)

  // update day entities
  // updatePairDayData(event)
  // updatePairHourData(event)
  // updateUniswapDayData(event)
  // updateTokenDayData(token0 as Token, event)
  // updateTokenDayData(token1 as Token, event)

  const nativePrice = getNativeTokenPrice()
  updatePoolDaySnapshot(event.block.timestamp, poolKpi)
  updatePoolHourSnapshot(event.block.timestamp, poolKpi)
  updateTokenDaySnapshot(event.block.timestamp, token0, token0Kpi, nativePrice)
  updateTokenDaySnapshot(event.block.timestamp, token1, token1Kpi, nativePrice)
}

export function onBurn(event: BurnEvent): void {
  log.debug('[ConstantProduct] onBurn...', [])

  const factory = getOrCreateConstantProductPoolFactory()
  factory.transactionCount = factory.transactionCount.plus(BigInt.fromI32(1))

  const poolAddress = event.address.toHex()
  const poolKpi = getConstantProductPoolKpi(poolAddress)
  const asset0 = getConstantProductPoolAsset(poolAddress.concat(':asset:0'))
  const asset1 = getConstantProductPoolAsset(poolAddress.concat(':asset:1'))

  const token0 = getOrCreateToken(asset0.token)
  const amount0 = event.params.amount0.divDecimal(
    BigInt.fromI32(10)
      .pow(token0.decimals.toI32() as u8)
      .toBigDecimal()
  )

  const token0Kpi = getTokenKpi(asset0.token)
  token0Kpi.liquidity = token0Kpi.liquidity.minus(amount0)
  token0Kpi.transactionCount = token0Kpi.transactionCount.plus(BigInt.fromI32(1))

  const token1 = getOrCreateToken(asset1.token)

  const amount1 = event.params.amount1.divDecimal(
    BigInt.fromI32(10)
      .pow(token1.decimals.toI32() as u8)
      .toBigDecimal()
  )

  const token1Kpi = getTokenKpi(asset1.token)
  token1Kpi.liquidity = token1Kpi.liquidity.minus(amount1)
  token1Kpi.transactionCount = token1Kpi.transactionCount.plus(BigInt.fromI32(1))

  const transaction = getOrCreateTransaction(event)

  const burn = new Burn('constant-product:' + transaction.id.toString() + ':' + poolKpi.transactionCount.toString())

  burn.transaction = transaction.id
  burn.pool = poolAddress
  burn.token0 = asset0.token
  burn.token1 = asset1.token
  burn.amount0 = amount0
  burn.amount1 = amount1
  burn.recipient = event.params.recipient
  burn.sender = event.params.sender
  burn.origin = event.transaction.from
  burn.logIndex = event.logIndex

  const liquidity = event.params.liquidity.divDecimal(BigInt.fromI32(10).pow(18).toBigDecimal())

  poolKpi.liquidity = poolKpi.liquidity.minus(liquidity)
  poolKpi.transactionCount = poolKpi.transactionCount.plus(BigInt.fromI32(1))
  poolKpi.save()

  factory.save()
  token0.save()
  token1.save()
  burn.save()

  const nativePrice = getNativeTokenPrice()
  updatePoolDaySnapshot(event.block.timestamp, poolKpi)
  updatePoolHourSnapshot(event.block.timestamp, poolKpi)
  updateTokenDaySnapshot(event.block.timestamp, token0, token0Kpi, nativePrice)
  updateTokenDaySnapshot(event.block.timestamp, token1, token1Kpi, nativePrice)
}

export function onSync(event: Sync): void {
  log.debug('[ConstantProduct] onSync...... event.reserve0: {} event.reserve1: {}', [
    event.params.reserve0.toString(),
    event.params.reserve1.toString(),
  ])

  const poolAddress = event.address.toHex()
  const poolKpi = getConstantProductPoolKpi(poolAddress)

  const asset0 = getConstantProductPoolAsset(poolAddress.concat(':asset:0'))
  const asset1 = getConstantProductPoolAsset(poolAddress.concat(':asset:1'))

  log.debug('[ConstantProduct] onSync...... pool.assets[0]: {} pool.assets[1]: {}', [asset0.id, asset1.id])

  const token0 = getOrCreateToken(asset0.token)
  const token1 = getOrCreateToken(asset1.token)

  const token0Kpi = getTokenKpi(asset0.token)
  const token1Kpi = getTokenKpi(asset1.token)

  // reset liquidity amounts
  token0Kpi.liquidity = token0Kpi.liquidity.minus(asset0.reserve)
  token1Kpi.liquidity = token0Kpi.liquidity.minus(asset1.reserve)

  log.debug('[ConstantProduct] onSync [BEFORE] pool.reserve0: {} pool.reserve1: {}', [
    asset0.reserve.toString(),
    asset1.reserve.toString(),
  ])

  const rebase0 = getRebase(asset0.token)
  const rebase1 = getRebase(asset1.token)

  const reserve0 = toAmount(event.params.reserve0, rebase0)
  const reserve1 = toAmount(event.params.reserve1, rebase1)

  asset0.reserve = reserve0.div(
    BigInt.fromI32(10)
      .pow(token0.decimals.toI32() as u8)
      .toBigDecimal()
  )

  asset1.reserve = reserve1.div(
    BigInt.fromI32(10)
      .pow(token1.decimals.toI32() as u8)
      .toBigDecimal()
  )

  if (asset1.reserve.notEqual(BigDecimal.fromString('0'))) {
    asset0.price = asset0.reserve.div(asset1.reserve)
  }

  if (asset0.reserve.notEqual(BigDecimal.fromString('0'))) {
    asset1.price = asset1.reserve.div(asset0.reserve)
  }

  log.debug('[ConstantProduct] onSync [AFTER] asset0.price: {} asset1.price: {}', [
    asset0.price.toString(),
    asset1.price.toString(),
  ])

  asset0.save()
  asset1.save()

  let nativePrice: TokenPrice
  let token0Price: TokenPrice
  let token1Price: TokenPrice

  // If the pool is one in which we want to update the native price
  if (STABLE_POOL_ADDRESSES.includes(poolAddress)) {
    if (token0.id == NATIVE_ADDRESS) {
      token0Price = updateTokenPrice(token0)
      token1Price = updateTokenPrice(token1)
      nativePrice = token0Price
    } else {
      token1Price = updateTokenPrice(token1)
      token0Price = updateTokenPrice(token0)
      nativePrice = token1Price
    }
  } else {
    // Avoid making this call unless neccasary
    nativePrice = getOrCreateTokenPrice(NATIVE_ADDRESS)
    token0Price = updateTokenPrice(token0)
    token1Price = updateTokenPrice(token1)
  }

  poolKpi.liquidityNative = asset0.reserve
    .times(token0Price.derivedNative)
    .plus(asset1.reserve.times(token1Price.derivedNative))
  poolKpi.liquidityUSD = poolKpi.liquidityNative.times(nativePrice.derivedUSD)
  poolKpi.save()

  token0Kpi.liquidity = token0Kpi.liquidity.plus(reserve0)
  token0Kpi.liquidityNative = token0Kpi.liquidityNative.plus(reserve0.times(token0Price.derivedNative))
  token0Kpi.liquidityUSD = token0Kpi.liquidityUSD.plus(token0Kpi.liquidityNative.times(nativePrice.derivedUSD))
  token0Kpi.save()

  token1Kpi.liquidity = token1Kpi.liquidity.plus(reserve1)
  token1Kpi.liquidityNative = token1Kpi.liquidityNative.plus(reserve1.times(token1Price.derivedNative))
  token1Kpi.liquidityUSD = token1Kpi.liquidityUSD.plus(token1Kpi.liquidityNative.times(nativePrice.derivedUSD))
  token1Kpi.save()
}

export function onSwap(event: SwapEvent): void {
  log.debug('[ConstantProduct] onSwap...', [])

  const tokenInAddress = event.params.tokenIn.toHex()
  const tokenOutAddress = event.params.tokenOut.toHex()
  const factory = getOrCreateConstantProductPoolFactory()
  factory.transactionCount = factory.transactionCount.plus(BigInt.fromI32(1))
  factory.save()

  const poolAddress = event.address.toHex()
  const poolKpi = getConstantProductPoolKpi(poolAddress)
  poolKpi.transactionCount = poolKpi.transactionCount.plus(BigInt.fromI32(1))
  poolKpi.save()

  const tokenIn = getOrCreateToken(tokenInAddress)

  const tokenInKpi = getTokenKpi(tokenInAddress)
  tokenInKpi.transactionCount = tokenInKpi.transactionCount.plus(BigInt.fromI32(1))
  tokenInKpi.save()

  const tokenOut = getOrCreateToken(tokenOutAddress)

  const tokenOutKpi = getTokenKpi(tokenOutAddress)
  tokenOutKpi.transactionCount = tokenOutKpi.transactionCount.plus(BigInt.fromI32(1))
  tokenOutKpi.save()

  const transaction = getOrCreateTransaction(event)

  const swap = new Swap('constant-product:' + transaction.id.toString() + ':' + poolKpi.transactionCount.toString())

  swap.transaction = transaction.id
  swap.pool = poolAddress
  swap.tokenIn = tokenIn.id
  swap.tokenOut = tokenOut.id
  swap.amountIn = event.params.amountIn.divDecimal(
    BigInt.fromI32(10)
      .pow(tokenIn.decimals.toI32() as u8)
      .toBigDecimal()
  )
  swap.amountOut = event.params.amountOut.divDecimal(
    BigInt.fromI32(10)
      .pow(tokenOut.decimals.toI32() as u8)
      .toBigDecimal()
  )
  swap.recipient = event.params.recipient
  swap.origin = event.transaction.from
  swap.logIndex = event.logIndex
  swap.save()

  const nativePrice = getNativeTokenPrice()

  updateTokenDaySnapshot(event.block.timestamp, tokenIn, tokenInKpi, nativePrice)
  updateTokenDaySnapshot(event.block.timestamp, tokenOut, tokenOutKpi, nativePrice)
}

export function onApproval(event: Approval): void {
  log.debug('[ConstantProduct] onApproval...', [])
}

export function onTransfer(event: Transfer): void {
  log.debug('[ConstantProduct] onTransfer... {} {} {}', [
    event.params.amount.divDecimal(BigDecimal.fromString('1e18')).toString(),
    event.params.recipient.toHex(),
    event.params.sender.toHex(),
  ])
  const poolAddress = event.address.toHex()
  const poolKpi = getConstantProductPoolKpi(poolAddress)

  // If sender is black hole, we're mintin'
  if (event.params.sender == ADDRESS_ZERO) {
    poolKpi.totalSupply = poolKpi.totalSupply.plus(event.params.amount)
  }

  // If recipient is black hole we're burnin'
  if (event.params.sender.toHex() == poolKpi.id && event.params.recipient == ADDRESS_ZERO) {
    poolKpi.totalSupply = poolKpi.totalSupply.minus(event.params.amount)
  }

  poolKpi.save()
}
