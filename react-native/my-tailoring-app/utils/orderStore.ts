
export interface Order {
  id: string;
  orderNo: string;
  service: string;
  item: string;
  date: string;
  status: "Pending" | "In Progress" | "To Pick up" | "Completed" | "Cancelled";
  price: number;
  description?: string;
  estimatedCompletion?: string;
  garmentType?: string;
  damageType?: string;
  specialInstructions?: string;
  clothingBrand?: string;
  quantity?: number;
  image?: string;
  appointmentDate?: string;
}

class OrderStore {
  private orders: Order[] = [];
  private listeners: (() => void)[] = [];
  private orderCounter = 1;

  addOrder(order: Omit<Order, 'id' | 'orderNo' | 'date'>) {
    const newOrder: Order = {
      ...order,
      id: Date.now().toString(),
      orderNo: `ORD-2025-${String(this.orderCounter).padStart(3, '0')}`,
      date: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      status: order.status || "Pending",
    };

    this.orders.unshift(newOrder);
    this.orderCounter++;
    this.notifyListeners();
    return newOrder;
  }

  getOrders(): Order[] {
    return [...this.orders];
  }

  getOrderById(id: string): Order | undefined {
    return this.orders.find(order => order.id === id);
  }

  updateOrderStatus(id: string, status: Order['status']) {
    const order = this.orders.find(o => o.id === id);
    if (order) {
      order.status = status;
      this.notifyListeners();
    }
  }

  removeOrder(id: string) {
    this.orders = this.orders.filter(order => order.id !== id);
    this.notifyListeners();
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}

export const orderStore = new OrderStore();