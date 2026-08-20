import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { menuApi, adminApi, restaurantApi } from '@/api/axios';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import LoadMore from '@/components/LoadMore';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Minus, Trash2, Printer, Receipt, ChefHat, Percent, Tag } from 'lucide-react';
import { toast } from 'sonner';



interface Product {
    _id: string;
    name: string;
    description: string;
    price: number;
    imageURL: string;
    category: { _id: string; name: string };
    isVeg: boolean;
    variants: any[];
    cgst: number;
    sgst: number;
    igst: number;
}

interface CartItem extends Product {
    cartQuantity: number;
    selectedVariant?: string;
    selectedPrice: number;
}

export default function AdminPOS() {
    const [mode, setMode] = useState<'TERMINAL' | 'HISTORY'>('TERMINAL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerName, setCustomerName] = useState('');
    const [customerMobile, setCustomerMobile] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [showReceipt, setShowReceipt] = useState(false);
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
    const [lastOrder, setLastOrder] = useState<any>(null);
    const [discountType, setDiscountType] = useState<'FLAT' | 'PERCENTAGE'>('FLAT');
    const [discountValue, setDiscountValue] = useState<string>('');

    // Fetch Menu
    const { data: menuData = [], isLoading } = useQuery({
        queryKey: ['admin-pos-menu'],
        queryFn: async () => {
            const res = await menuApi.getMenu();
            return res.data;
        }
    });

    // Fetch Restaurant Details for Header
    const { data: restaurant } = useQuery({
        queryKey: ['restaurant-settings'],
        queryFn: async () => {
            const res = await restaurantApi.get();
            return res.data;
        }
    });

    const restName = restaurant?.name || "HALDIA CLOUD KITCHEN & RESTAURANT";
    const restAddress = restaurant?.address || "123 Tasty Street, Sector 4, Food City, FC 450001";
    const restPhone = restaurant?.mobile || "+91 98765 43210";
    const restGst = restaurant?.gstIn || "22AAAAA0000A1Z5";

    // Generate unique categories for filter
    const categories = useMemo(() => {
        const cats = new Set<string>();
        cats.add('All');
        menuData.forEach((item: Product) => {
            if (item.category?.name) cats.add(item.category.name);
        });
        return Array.from(cats);
    }, [menuData]);

    const filteredMenu = useMemo(() => {
        return menuData.filter((item: Product) => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCat = selectedCategory === 'All' || item.category?.name === selectedCategory;
            return matchesSearch && matchesCat;
        });
    }, [menuData, searchTerm, selectedCategory]);

    // Cart Handlers
    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item._id === product._id);
            if (existing) {
                return prev.map(item =>
                    item._id === product._id
                        ? { ...item, cartQuantity: item.cartQuantity + 1 }
                        : item
                );
            }
            // Use variant price if available, else base price
            const basePrice = product.variants && product.variants.length > 0 ? product.variants[0].price : product.price;
            return [...prev, { ...product, cartQuantity: 1, selectedPrice: basePrice }];
        });
    };

    const updateQuantity = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item._id === id) {
                const newQuantity = item.cartQuantity + delta;
                return newQuantity > 0 ? { ...item, cartQuantity: newQuantity } : item;
            }
            return item;
        }));
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item._id !== id));
    };

    // Calculate Totals
    const cartTotal = useMemo(() => {
        return cart.reduce((total, item) => total + (item.selectedPrice * item.cartQuantity), 0);
    }, [cart]);

    const taxTotal = useMemo(() => {
        return cart.reduce((total, item) => {
            const itemBaseTotal = item.selectedPrice * item.cartQuantity;
            const cgst = (itemBaseTotal * (item.cgst || 0)) / 100;
            const sgst = (itemBaseTotal * (item.sgst || 0)) / 100;
            const igst = (itemBaseTotal * (item.igst || 0)) / 100;
            return total + cgst + sgst + igst;
        }, 0);
    }, [cart]);

    const discountAmount = useMemo(() => {
        const val = parseFloat(discountValue) || 0;
        if (val <= 0) return 0;
        const subtotalWithTax = cartTotal + taxTotal;
        if (discountType === 'FLAT') {
            return Math.min(val, subtotalWithTax);
        } else {
            return Math.min((subtotalWithTax * val) / 100, subtotalWithTax);
        }
    }, [cartTotal, taxTotal, discountType, discountValue]);

    const grandTotal = Math.ceil(cartTotal + taxTotal - discountAmount);

    // Create POS Order Mutation
    const createPosMutation = useMutation({
        mutationFn: adminApi.createPOSOrder,
        onSuccess: (data) => {
            toast.success("Bill Generated Successfully!");
            setLastOrder(data.data);
            setShowReceipt(true);
            // Reset form
            setCart([]);
            setCustomerName('');
            setCustomerMobile('');
            setPaymentMethod('CASH');
            setDiscountType('FLAT');
            setDiscountValue('');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to generate bill");
        }
    });

    const handleGenerateBill = () => {
        if (cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }

        const orderData = {
            customerName,
            customerMobile,
            paymentMethod,
            discountType: parseFloat(discountValue) > 0 ? discountType : 'NONE',
            discountValue: parseFloat(discountValue) || 0,
            items: cart.map(item => ({
                product: item._id,
                variant: 'Standard',
                quantity: item.cartQuantity
            }))
        };

        createPosMutation.mutate(orderData);
    };

    const printReceipt = () => {
        window.print();
    };


    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row overflow-hidden bg-background relative">

            {/* LEFT PANE: Menu & Products */}
            <div className="flex-1 flex flex-col border-r border-border bg-muted/20">
                {/* Header / Search */}
                <div className="p-4 bg-card border-b border-border flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <ChefHat className="text-primary h-6 w-6" />
                            Point of Sale
                        </h1>
                        <div className="flex bg-muted rounded-xl p-1 w-fit">
                            <button
                                onClick={() => setMode('TERMINAL')}
                                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${mode === 'TERMINAL' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                Terminal
                            </button>
                            <button
                                onClick={() => setMode('HISTORY')}
                                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${mode === 'HISTORY' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                History
                            </button>
                        </div>
                    </div>

                    {mode === 'TERMINAL' && (
                        <>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Search products..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Categories Horizontal Scroll */}
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === cat
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'bg-background border border-border text-foreground hover:bg-muted'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {mode === 'TERMINAL' ? (
                    <>
                        {/* Products Grid */}
                        <div className="flex-1 overflow-y-auto p-2 sm:p-4 pb-28 lg:pb-4">
                            {isLoading ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 animate-pulse">
                                    {[...Array(10)].map((_, i) => (
                                        <div key={i} className="bg-card rounded-xl h-40 border border-border"></div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                                    {filteredMenu.map((product) => (
                                        <button
                                            key={product._id}
                                            onClick={() => addToCart(product)}
                                            className="group relative flex flex-col items-center p-2 sm:p-3 bg-card border border-border rounded-xl sm:rounded-2xl hover:border-primary hover:shadow-md transition-all text-left"
                                        >
                                            <div className="w-full aspect-[4/3] sm:aspect-square rounded-lg sm:rounded-xl overflow-hidden mb-2 sm:mb-3 bg-muted">
                                                <img
                                                    src={product.imageURL || 'https://via.placeholder.com/150'}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                />
                                            </div>
                                            <h3 className="w-full font-bold text-xs sm:text-sm line-clamp-2 leading-tight mb-0.5 sm:mb-1">{product.name}</h3>
                                            <span className="w-full text-primary font-bold text-sm sm:text-base mt-auto">
                                                ₹{product.variants?.[0]?.price || product.price || 0}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <POSHistory onReprint={(order) => { setLastOrder(order); setShowReceipt(true); }} />
                )}
            </div>

            {/* RIGHT PANE: Current Bill - ONLY VISIBLE IN TERMINAL MODE */}
            {mode === 'TERMINAL' && (
                <>
                    {/* Mobile Dimmer Overlay */}
                    {isMobileCartOpen && (
                        <div
                            className="absolute inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
                            onClick={() => setIsMobileCartOpen(false)}
                        />
                    )}

                    <div className={`absolute inset-y-0 right-0 z-40 w-full sm:w-[380px] flex flex-col bg-card shadow-2xl transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 print:hidden ${isMobileCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                        <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Receipt className="h-5 w-5 text-primary" />
                                Current Bill
                            </h2>
                            <button
                                onClick={() => setIsMobileCartOpen(false)}
                                className="lg:hidden p-2 text-muted-foreground bg-background rounded-full hover:bg-muted font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            <AnimatePresence>
                                {cart.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 opacity-60">
                                        <Receipt className="h-12 w-12" />
                                        <p>No items added yet</p>
                                    </div>
                                ) : (
                                    cart.map(item => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            key={item._id}
                                            className="flex items-center justify-between p-3 rounded-xl border border-border bg-background"
                                        >
                                            <div className="flex-1 min-w-0 pr-3">
                                                <h4 className="font-bold text-sm truncate">{item.name}</h4>
                                                <p className="text-primary font-medium text-sm">₹{item.selectedPrice}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center bg-muted rounded-lg">
                                                    <button
                                                        onClick={() => updateQuantity(item._id, -1)}
                                                        className="p-1.5 hover:bg-background rounded-l-lg hover:text-primary transition-colors"
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </button>
                                                    <span className="w-6 text-center text-sm font-bold">{item.cartQuantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item._id, 1)}
                                                        className="p-1.5 hover:bg-background rounded-r-lg hover:text-primary transition-colors"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => removeFromCart(item._id)}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Checkout Section */}
                        <div className="p-4 border-t border-border bg-muted/10 space-y-4">

                            {/* Customer Details */}
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    placeholder="Customer Name (Opt)"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <input
                                    type="text"
                                    placeholder="Phone (Opt)"
                                    value={customerMobile}
                                    onChange={(e) => setCustomerMobile(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            {/* Payment Method */}
                            <div className="flex gap-2 p-1 bg-muted rounded-xl">
                                {['CASH', 'UPI', 'CARD'].map(method => (
                                    <button
                                        key={method}
                                        onClick={() => setPaymentMethod(method)}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${paymentMethod === method
                                            ? 'bg-background shadow text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        {method}
                                    </button>
                                ))}
                            </div>

                            {/* Discount Section */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Tag className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-bold text-foreground">Discount</span>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex p-0.5 bg-muted rounded-lg flex-shrink-0">
                                        <button
                                            onClick={() => setDiscountType('FLAT')}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${discountType === 'FLAT' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
                                        >
                                            ₹ Flat
                                        </button>
                                        <button
                                            onClick={() => setDiscountType('PERCENTAGE')}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${discountType === 'PERCENTAGE' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
                                        >
                                            <Percent className="h-3 w-3" />
                                        </button>
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder={discountType === 'FLAT' ? 'Amount (₹)' : 'Percent (%)'}
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(e.target.value)}
                                        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-green-500"
                                    />
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Subtotal</span>
                                    <span>₹{cartTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Taxes (GST)</span>
                                    <span>₹{taxTotal.toFixed(2)}</span>
                                </div>
                                {discountAmount > 0 && (
                                    <div className="flex justify-between text-green-600 font-medium">
                                        <span>Discount ({discountType === 'FLAT' ? `₹${parseFloat(discountValue).toFixed(0)}` : `${discountValue}%`})</span>
                                        <span>-₹{discountAmount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-extrabold text-xl pt-2 border-t border-border/50">
                                    <span>Total</span>
                                    <span>₹{grandTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            <button
                                onClick={handleGenerateBill}
                                disabled={cart.length === 0 || createPosMutation.isPending}
                                className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {createPosMutation.isPending ? "Generating..." : "Generate Bill"}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* RECEIPT MODAL / OVERLAY */}
            {/* The Print Layout handles actual printing. We show a preview here. */}
            <AnimatePresence>
                {showReceipt && lastOrder && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden"
                            onClick={() => setShowReceipt(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white text-black p-8 rounded-2xl w-full max-w-sm shadow-2xl relative"
                            >
                                {/* Receipt Preview Content */}
                                <div className="text-center font-mono text-sm leading-relaxed">
                                    <h2 className="text-2xl font-black mb-1">{restName}</h2>
                                    <p className="px-4 leading-tight mb-1">{restAddress}</p>
                                    <p>Ph: {restPhone}</p>
                                    <p className="mb-4">GSTIN: {restGst}</p>

                                    <div className="border-t-2 border-dashed border-gray-300 py-2 my-2 text-left space-y-1">
                                        <p>Date: {new Date().toLocaleString()}</p>
                                        <p>Order #: {lastOrder.customId}</p>
                                        <p>Customer: {lastOrder.customerName || 'Walk-in'}</p>
                                    </div>

                                    <div className="border-t-2 border-b-2 border-dashed border-gray-300 py-3 my-3">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-gray-200">
                                                    <th className="pb-1 font-bold">Item</th>
                                                    <th className="pb-1 text-center font-bold">Qty</th>
                                                    <th className="pb-1 text-right font-bold">Price</th>
                                                </tr>
                                            </thead>
                                            <tbody className="align-top">
                                                {lastOrder.items?.map((item: any, idx: number) => (
                                                    <tr key={idx}>
                                                        <td className="py-1 pr-2 line-clamp-2">{cart.find(c => c._id === item.product)?.name || 'Item'}</td>
                                                        <td className="py-1 text-center">{item.quantity}</td>
                                                        <td className="py-1 text-right">₹{(item.price * item.quantity).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="space-y-1 text-right mb-4">
                                        <div className="flex justify-between">
                                            <span>Sub Total</span>
                                            <span>₹{(lastOrder.totalAmount || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Taxes (GST)</span>
                                            <span>₹{(lastOrder.taxAmount || 0).toFixed(2)}</span>
                                        </div>
                                        {lastOrder.discountApplied > 0 && (
                                            <div className="flex justify-between text-green-600">
                                                <span>Discount ({lastOrder.discountType === 'PERCENTAGE' ? `${lastOrder.discountValue}%` : `₹${lastOrder.discountValue}`})</span>
                                                <span>-₹{(lastOrder.discountApplied || 0).toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between font-black text-lg pt-2 mt-2 border-t border-gray-300">
                                            <span>TOTAL</span>
                                            <span>₹{(lastOrder.finalAmount || 0).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="border-t-2 border-dashed border-gray-300 pt-3">
                                        <p>Paid By: {lastOrder.paymentMethod}</p>
                                        <p className="mt-4 font-bold uppercase tracking-widest">Thank You!</p>
                                        <p>Please Visit Again</p>
                                    </div>
                                </div>

                                <button
                                    onClick={printReceipt}
                                    className="mt-8 w-full py-3 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
                                >
                                    <Printer className="h-5 w-5" /> Print Receipt
                                </button>
                            </motion.div>
                        </motion.div>

                        {/* ACTUAL PRINT ELEMENT - Only visible during print */}
                        <div id="printable-receipt" className="hidden print:block print:absolute print:inset-0 print:bg-white print:text-black font-mono text-sm leading-relaxed p-4">
                            <div className="text-center">
                                <h2 className="text-xl font-black mb-1">{restName}</h2>
                                <p className="text-xs leading-tight mb-1">{restAddress}</p>
                                <p className="text-xs">Ph: {restPhone}</p>
                                <p className="text-xs mb-2">GSTIN: {restGst}</p>
                            </div>

                            <div className="border-t border-dashed border-black py-1 my-1 text-left text-xs space-y-0.5">
                                <p>Date: {new Date().toLocaleString()}</p>
                                <p>Order #: {lastOrder.customId}</p>
                                <p>Cust: {lastOrder.customerName || 'Walk-in'}</p>
                            </div>

                            <div className="border-t border-b border-dashed border-black py-2 my-2 text-xs">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-black">
                                            <th className="pb-1 font-bold">Item</th>
                                            <th className="pb-1 text-center font-bold w-8">Qty</th>
                                            <th className="pb-1 text-right font-bold w-12">Amt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="align-top">
                                        {lastOrder.items?.map((item: any, idx: number) => (
                                            <tr key={idx}>
                                                <td className="py-1 pr-1 truncate max-w-[40mm]">{cart.find(c => c._id === item.product)?.name || 'Item'}</td>
                                                <td className="py-1 text-center">{item.quantity}</td>
                                                <td className="py-1 text-right">{(item.price * item.quantity).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="space-y-0.5 text-right mb-2 text-xs">
                                <div className="flex justify-between">
                                    <span>Sub Total</span>
                                    <span>₹{(lastOrder.totalAmount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Taxes</span>
                                    <span>₹{(lastOrder.taxAmount || 0).toFixed(2)}</span>
                                </div>
                                {lastOrder.discountApplied > 0 && (
                                    <div className="flex justify-between">
                                        <span>Discount ({lastOrder.discountType === 'PERCENTAGE' ? `${lastOrder.discountValue}%` : `₹${lastOrder.discountValue}`})</span>
                                        <span>-₹{(lastOrder.discountApplied || 0).toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-black text-sm pt-1 mt-1 border-t border-black">
                                    <span>TOTAL</span>
                                    <span>₹{(lastOrder.finalAmount || 0).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="border-t border-dashed border-black pt-2 text-center text-xs">
                                <p className="text-left">Paid By: {lastOrder.paymentMethod}</p>
                                <p className="mt-3 font-bold uppercase">Thank You!</p>
                                <p>Please Visit Again</p>
                            </div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* Mobile View Cart FAB */}
            {mode === 'TERMINAL' && !isMobileCartOpen && (
                <button
                    onClick={() => setIsMobileCartOpen(true)}
                    className="lg:hidden absolute bottom-6 right-6 z-20 px-6 py-4 bg-primary text-primary-foreground rounded-full shadow-2xl flex items-center justify-center gap-3 hover:scale-105 transition-transform"
                >
                    <Receipt className="h-6 w-6" />
                    <span className="font-bold text-lg">
                        {cart.reduce((sum, item) => sum + item.cartQuantity, 0)} Items
                    </span>
                    <span className="font-black border-l border-primary-foreground/20 pl-3">
                        ₹{grandTotal.toFixed(2)}
                    </span>
                </button>
            )}
        </div>
    );
}

function POSHistory({ onReprint }: { onReprint: (order: any) => void }) {
    const {
        items: records,
        isLoading,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
    } = useInfiniteList<any>(['admin-pos-orders'], (p) => adminApi.getPOSOrders(p));

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading POS History...</div>;
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-background">
            {records.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                    <Receipt className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">No offline bills generated yet.</p>
                </div>
            ) : (
                <div className="grid gap-4 w-full max-w-5xl mx-auto">
                    {records.map((order: any) => (
                        <div key={order._id} className="bg-card border border-border p-5 rounded-xl shadow-sm flex items-center justify-between hover:border-primary/50 transition-colors">
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-lg text-foreground flex items-center gap-2">
                                    {order.customId || order._id.slice(-6).toUpperCase()}
                                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-medium tracking-wide">
                                        {new Date(order.createdAt).toLocaleString()}
                                    </span>
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    Customer: <strong className="text-foreground">{order.customerName || 'Walk-in'}</strong> {order.customerMobile ? `(${order.customerMobile})` : ''}
                                </span>
                                <span className="text-xs text-muted-foreground mt-1">
                                    {order.items?.length || 0} Items • {order.paymentMethod}
                                    {order.discountApplied > 0 && (
                                        <span className="ml-2 text-green-600 font-semibold">• Disc: ₹{order.discountApplied?.toFixed(2)}</span>
                                    )}
                                </span>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right flex flex-col">
                                    <span className="text-xs text-muted-foreground">Final Total</span>
                                    <span className="text-2xl font-black text-primary">₹{(order.finalAmount || 0).toFixed(2)}</span>
                                </div>
                                <button
                                    onClick={() => onReprint(order)}
                                    className="p-3 bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl transition-colors shadow-sm"
                                    title="View & Reprint Receipt"
                                >
                                    <Printer className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                    <LoadMore hasMore={!!hasNextPage} isFetching={isFetchingNextPage} onLoad={fetchNextPage} />
                </div>
            )}
        </div>
    );
}
