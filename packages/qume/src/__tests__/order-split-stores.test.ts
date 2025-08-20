import { scope } from '../internal/scope'
import { runMain } from '../internal/MainStore'

// Mock services
const mockNotificationService = { push: jest.fn() }
const mockPaymentGateway = { charge: jest.fn().mockResolvedValue({ success: true, transactionId: 'tx-123' }) }

// Event types
const ORDER_PLACED = 'ORDER_PLACED'
const ITEM_ADDED = 'ITEM_ADDED'
const INVENTORY_RESERVED = 'INVENTORY_RESERVED'
const PAYMENT_PROCESSED = 'PAYMENT_PROCESSED'
const ORDER_CONFIRMED = 'ORDER_CONFIRMED'

type OrderEvent =
  | { type: typeof ORDER_PLACED, orderId: string, customerId: string, timestamp: number }
  | { type: typeof ITEM_ADDED, orderId: string, productId: string, quantity: number, price: number }
  | { type: typeof INVENTORY_RESERVED, orderId: string, productId: string, quantity: number }
  | { type: typeof PAYMENT_PROCESSED, orderId: string, amount: number, transactionId: string }
  | { type: typeof ORDER_CONFIRMED, orderId: string, totalAmount: number }

describe('Split Store Architecture', () => {
  const timeout = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('demonstrates domain-focused stores with event communication', async () => {
    const { query, store, action, join } = scope<OrderEvent>()

    // ORDER DOMAIN - handles order lifecycle
    const orderStore = store({
      placeOrder: action((customerId: string) => ({
        type: ORDER_PLACED,
        orderId: `order-${Date.now()}`,
        customerId,
        timestamp: Date.now()
      })).internal().external(),

      addItem: action((orderId: string, productId: string, quantity: number, price: number) => ({
        type: ITEM_ADDED,
        orderId,
        productId,
        quantity,
        price
      })).internal().external(),

      // Track orders and totals
      orders: query(ORDER_PLACED).by.orderId,

      orderTotals: query(ITEM_ADDED)
        .by.orderId
        .map(item => item.price * item.quantity)
        .reduce((a, b) => a + b),
    })

    // INVENTORY DOMAIN - handles stock management
    const inventoryStore = store({
      // Reserve inventory when items are added to orders
      reserveInventory: query(ITEM_ADDED)
        .internal(item => ({
          type: INVENTORY_RESERVED,
          orderId: item.orderId,
          productId: item.productId,
          quantity: item.quantity
        }))
        .external(),

      // Track reservations by product
      reservations: query(INVENTORY_RESERVED)
        .by.productId
        .map(r => r.quantity)
        .reduce((a, b) => a + b),
    })

    // PAYMENT DOMAIN - handles payment processing
    const paymentStore = store({
      // Process payment when all items are reserved
      processPayment: join({
        orderId: query(ORDER_PLACED).by.orderId.select.orderId,
        total: query(ITEM_ADDED)
          .by.orderId
          .map(item => item.price * item.quantity)
          .reduce((a, b) => a + b),
        itemCount: query(ITEM_ADDED)
          .by.orderId
          .map(() => 1)
          .reduce((a, b) => a + b),
        reservedCount: query(INVENTORY_RESERVED)
          .by.orderId
          .map(() => 1)
          .reduce((a, b) => a + b)
      })
        .filter(order => order.itemCount === order.reservedCount) // All items reserved
        .evalMap(async order => {
          const result = await mockPaymentGateway.charge(order.orderId, order.total)
          return {
            type: PAYMENT_PROCESSED,
            orderId: order.orderId,
            amount: order.total,
            transactionId: result.transactionId
          }
        })
        .internal()
        .external(),

      // Send confirmation notifications
      confirmations: query(PAYMENT_PROCESSED)
        .evalTap(async payment => {
          await mockNotificationService.push(
            'customer@example.com',
            `Order ${payment.orderId} confirmed! Total: $${payment.amount}`
          )
        })
        .internal(payment => ({
          type: ORDER_CONFIRMED,
          orderId: payment.orderId,
          totalAmount: payment.amount
        }))
        .external(),
    })

    // Events flow between all stores automatically
    const main = runMain({ orderStore, inventoryStore, paymentStore })

    // Test cross-domain coordination
    const order = await main.actions(orderStore).placeOrder('customer-123')
    await timeout(10)

    // Add items to the order
    await main.actions(orderStore).addItem(order.orderId, 'product-1', 2, 50.00)
    await main.actions(orderStore).addItem(order.orderId, 'product-2', 1, 50.00)
    await timeout(50) // Allow async operations to complete

    // Verify each domain has processed its responsibilities
    const orders = await main.readQuery(orderStore.orders)
    expect(orders[order.orderId]).toBeDefined()

    const orderTotals = await main.readQuery(orderStore.orderTotals)
    expect(orderTotals[order.orderId]).toBe(150.00)

    const reservations = await main.readQuery(inventoryStore.reservations)
    expect(reservations['product-1']).toBe(2)
    expect(reservations['product-2']).toBe(1)

    // Verify payment was processed due to cross-store communication
    expect(mockPaymentGateway.charge).toHaveBeenCalledWith(order.orderId, 150.00)

    // Verify notification was sent
    expect(mockNotificationService.push).toHaveBeenCalledWith(
      'customer@example.com',
      expect.stringContaining(`Order ${order.orderId} confirmed!`)
    )
  })
})
