
import React from "react";
import { Routes, Route } from "react-router-dom";
import "./App.css";

import GuestHomePage from "./user/GuestHomePage";
import UserHomePage from "./user/UserHomePage";
import Profile from "./user/Profile";
import RentalPage from "./user/RentalPage";
import OrderDetails from "./user/OrderDetails";

import AdminPage from "./admin/AdminPage";
import Rental from "./admin/Rental";
import DryCleaning from "./admin/drycleaning";
import Repair from "./admin/repair";
import Post from "./admin/PostRent";
import Inventory from "./admin/Inventory";
import Customize from "./admin/Customize";
import Billing from "./admin/Billing";
import CustomerList from "./admin/CustomerList";
import ShopSchedule from "./admin/ShopSchedule";
import WalkInOrders from "./admin/WalkInOrders";
import OrdersInventory from "./admin/OrdersInventory";
import ClerkManagement from "./admin/ClerkManagement";
import DeletedOrdersArchive from "./admin/DeletedOrdersArchive";
import Customizer3DPage from "./pages/Customizer3DPage";
import GoogleAuthCallback from "./components/auth/GoogleAuthCallback";

const App = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<GuestHomePage />} />
        <Route path="/user-home" element={<UserHomePage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/rentals" element={<RentalPage />} />
        <Route path="/orders/:orderItemId" element={<OrderDetails />} />
        <Route path="/auth/callback" element={<GoogleAuthCallback />} />
        <Route path="/3d-customizer" element={<Customizer3DPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/rental" element={<Rental />} />
        <Route path="/drycleaning" element={<DryCleaning />} />
        <Route path="/repair" element={<Repair />} />
        <Route path="/post" element={<Post />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/customize" element={<Customize />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/customers" element={<CustomerList />} />
        <Route path="/shop-schedule" element={<ShopSchedule />} />
        <Route path="/walk-in-orders" element={<WalkInOrders />} />
        <Route path="/reports" element={<OrdersInventory />} />
        <Route path="/rental-inventory" element={<OrdersInventory />} />
        <Route path="/orders-inventory" element={<OrdersInventory />} />
        <Route path="/clerk-management" element={<ClerkManagement />} />
        <Route path="/deleted-orders-archive" element={<DeletedOrdersArchive />} />

      </Routes>
    </>
  );
};

export default App;
