
export interface CartItem {
  id: string;
  service: string;
  item: string;
  description: string;
  price: number;
  icon: any;
  quantity?: number;
  garmentType?: string;
  damageType?: string;
  specialInstructions?: string;
  clothingBrand?: string;
  image?: string;
  appointmentDate?: string;
}

class CartStore {
  private items: CartItem[] = [];
  private listeners: (() => void)[] = [];

  addItem(item: CartItem) {
    this.items.push(item);
    this.notifyListeners();
  }

  removeItem(id: string) {
    this.items = this.items.filter((item) => item.id !== id);
    this.notifyListeners();
  }

  getItems(): CartItem[] {
    return [...this.items];
  }

  clearCart() {
    this.items = [];
    this.notifyListeners();
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }
}

export const cartStore = new CartStore();
