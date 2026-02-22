import React, { useState } from 'react';
import { Heart, ShoppingCart, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import '../styles/rental_user.css';

export default function ClothingRentalStore() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [scrollIndex, setScrollIndex] = useState(0);

  const categories = [
    { id: 1, name: 'Dresses', icon: '👗' },
    { id: 2, name: 'Tops', icon: '👔' },
    { id: 3, name: 'Jackets', icon: '🧥' },
    { id: 4, name: 'Accessories', icon: '👜' },
    { id: 5, name: 'View All', icon: '+' }
  ];

  const rentalItems = [
    { id: 1, name: 'Navy Velvet Blazer', price: '₹499', image: 'https://images.unsplash.com/photo-1591047990979-88d5962e536f?w=300&h=400&fit=crop', category: 'Jackets' },
    { id: 2, name: 'Magenta Evening Gown', price: '₹899', image: 'https://images.unsplash.com/photo-1595777707802-44b157645c12?w=300&h=400&fit=crop', category: 'Dresses' },
    { id: 3, name: 'Teal Silk Saree', price: '₹699', image: 'https://images.unsplash.com/photo-1609689379436-4058ee12adbe?w=300&h=400&fit=crop', category: 'Dresses' },
    { id: 4, name: 'Charcoal Blazer', price: '₹549', image: 'https://images.unsplash.com/photo-1591047990979-88d5962e536f?w=300&h=400&fit=crop', category: 'Jackets' },
    { id: 5, name: 'Rose Gold Dress', price: '₹759', image: 'https://images.unsplash.com/photo-1595777707802-44b157645c12?w=300&h=400&fit=crop', category: 'Dresses' },
  ];

  const handleScroll = (direction) => {
    if (direction === 'left' && scrollIndex > 0) {
      setScrollIndex(scrollIndex - 1);
    } else if (direction === 'right' && scrollIndex < rentalItems.length - 3) {
      setScrollIndex(scrollIndex + 1);
    }
  };

  const addToCart = (item) => {
    setCart([...cart, item]);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 w-full bg-white bg-opacity-95 shadow-lg z-50 px-8 py-6">
        <div className="flex justify-between items-center">
          <div className="text-2xl font-bold text-amber-900">RentStyle</div>

          <nav className="hidden md:flex gap-8">
            <a href="#" className="text-gray-600 hover:text-amber-900 font-medium text-lg">Home</a>
            <a href="#" className="text-gray-600 hover:text-amber-900 font-medium text-lg">Services</a>
            <a href="#" className="text-gray-600 hover:text-amber-900 font-medium text-lg">Rentals</a>
            <a href="#" className="text-gray-600 hover:text-amber-900 font-medium text-lg">About</a>
          </nav>

          <div className="flex items-center gap-6">
            <button className="relative">
              <ShoppingCart className="text-gray-600" size={24} />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {cart.length}
                </span>
              )}
            </button>
            <div className="flex items-center gap-3">
              <span className="text-gray-600 text-sm">Welcome</span>
              <span className="text-amber-900 font-bold text-lg">Guest</span>
            </div>
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden ml-4"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>
      <section className="mt-24 h-96 bg-gradient-to-r from-gray-900 to-gray-700 rounded-xl overflow-hidden mx-4 relative">
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-5xl font-bold mb-4">Why Buy?</h1>
            <p className="text-2xl opacity-90">Rent the Vibe</p>
          </div>
        </div>
      </section>
      <section className="px-8 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Category</h2>
        <div className="grid grid-cols-5 gap-6 md:flex md:flex-wrap">
          {categories.map(cat => (
            <div key={cat.id} className="flex flex-col items-center gap-3 cursor-pointer hover:scale-105 transition">
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-3xl hover:bg-amber-900 hover:text-white transition">
                {cat.icon}
              </div>
              <span className="text-sm text-gray-700 text-center">{cat.name}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="px-8 py-12 bg-amber-50">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Rental Clothes</h2>

        <div className="relative">
          {scrollIndex > 0 && (
            <button
              onClick={() => handleScroll('left')}
              className="absolute -left-6 top-1/2 transform -translate-y-1/2 z-10 bg-amber-900 text-white p-2 rounded-full hover:bg-amber-800"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="flex gap-6 overflow-hidden">
            {rentalItems.map((item, idx) => (
              <div
                key={item.id}
                className={`flex-shrink-0 w-72 cursor-pointer transform transition-transform duration-300 ${
                  idx >= scrollIndex && idx < scrollIndex + 3 ? 'translate-x-0 opacity-100' : 'hidden'
                }`}
                onClick={() => setSelectedItem(item)}
              >
                <div className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl hover:scale-105 transition">
                  <div className="relative h-80 overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    <button className="absolute top-3 right-3 bg-white rounded-full p-2 hover:bg-gray-100">
                      <Heart size={18} className="text-gray-600" />
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-amber-900 text-lg mb-2">{item.name}</h3>
                    <p className="text-red-600 font-bold text-xl mb-3">{item.price}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(item);
                      }}
                      className="w-full bg-gradient-to-r from-amber-900 to-amber-700 text-white font-semibold py-2 rounded-full hover:shadow-lg transition"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {scrollIndex < rentalItems.length - 3 && (
            <button
              onClick={() => handleScroll('right')}
              className="absolute -right-6 top-1/2 transform -translate-y-1/2 z-10 bg-amber-900 text-white p-2 rounded-full hover:bg-amber-800"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: Math.max(1, rentalItems.length - 2) }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setScrollIndex(idx)}
              className={`w-3 h-3 rounded-full transition ${
                idx === scrollIndex ? 'bg-amber-900' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </section>
      <footer className="bg-gray-900 text-white py-8 text-center">
        <p>© 2024 RentStyle - Rent Fashion, Not Your Closet</p>
      </footer>
    </div>
  );
}