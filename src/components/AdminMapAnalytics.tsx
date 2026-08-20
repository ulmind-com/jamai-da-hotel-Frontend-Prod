import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/axios";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Map as MapIcon, Loader2, CalendarIcon, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import { toast } from "sonner";

// Fit bounds to map data dynamically
const MapBoundsFitter = ({ mapData }: { mapData: any[] }) => {
    const map = useMap();
    useEffect(() => {
        if (mapData && mapData.length > 0) {
            const validPoints = mapData.filter(d => Array.isArray(d) ? d[0]?.lat && d[0]?.lng : d.lat && d.lng);
            if (validPoints.length > 0) {
                // If the data is grouped (arrays), extract the primary lat/lng
                const bounds = L.latLngBounds(validPoints.map(d => Array.isArray(d) ? [d[0].lat, d[0].lng] : [d.lat, d.lng]));
                // Dynamically fit map nicely keeping pins fully visible
                map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 17, duration: 1.5 });
            }
        }
    }, [mapData, map]);
    return null;
}

const createCustomIcon = (group: any[]) => {
    const mainOrder = group[0];
    const image = mainOrder.customerImage || `https://ui-avatars.com/api/?name=${mainOrder.customerName || 'U'}&background=random`;
    const count = group.length;

    const htmlString = `
        <div class="relative flex items-center justify-center w-8 h-8 mx-auto mt-2 transition-transform hover:scale-110">
            <div class="absolute inset-0 bg-primary rounded-full shadow-md opacity-20 animate-pulse"></div>
            <img src="${image}" onerror="this.src='https://ui-avatars.com/api/?name=U&background=random'" class="w-full h-full rounded-full border-2 border-primary object-cover shadow-sm relative z-10 bg-white" style="aspect-ratio: 1/1;" />
            ${count > 1 ? `<div class="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] leading-none font-extrabold px-1.5 py-0.5 rounded-full z-20 shadow-sm border-[1.5px] border-white min-w-[16px] text-center">${count}</div>` : ''}
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[8px] border-l-transparent border-r-transparent border-t-primary z-0 drop-shadow-sm"></div>
        </div>
    `;

    return L.divIcon({
        html: htmlString,
        className: 'custom-profile-marker bg-transparent border-0',
        iconSize: [40, 48],
        iconAnchor: [20, 48],
        popupAnchor: [0, -48]
    });
};

export default function AdminMapAnalytics() {
    const mapRef = useRef<HTMLDivElement>(null);
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    const { data: mapData, isLoading } = useQuery({
        queryKey: ["admin-map-analytics", startDate, endDate],
        queryFn: async () => {
            const params: any = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            const res = await adminApi.getMapAnalytics(params);
            return res.data;
        },
    });

    const groupedData = useMemo(() => {
        if (!mapData) return [];
        const grouped: Record<string, any[]> = {};
        mapData.forEach((order: any) => {
            if (order.lat && order.lng) {
                const key = `${order.lat},${order.lng}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(order);
            }
        });
        return Object.values(grouped);
    }, [mapData]);

    const handleExport = async () => {
        if (!mapRef.current) return;

        toast.info("Generating high-quality map image...");
        setTimeout(async () => {
            try {
                const canvas = await html2canvas(mapRef.current!, {
                    useCORS: true,
                    allowTaint: true,
                    scale: 2, // High resolution
                    ignoreElements: (element) => {
                        return element.classList.contains("leaflet-control-zoom");
                    }
                });

                const link = document.createElement("a");
                link.download = `Map_Analytics_${new Date().toISOString().split('T')[0]}.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
                toast.success("Map image exported successfully!");
            } catch (err) {
                console.error(err);
                toast.error("Failed to export map image. Ensure map tiles are fully loaded.");
            }
        }, 500);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h2 className="text-3xl flex items-center gap-3 font-bold tracking-tight text-foreground">
                        <MapIcon className="h-8 w-8 text-primary" />
                        Live Map Analytics
                    </h2>
                    <p className="text-sm text-muted-foreground">Visualize your customer orders geographically.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-lg border bg-card p-2 shadow-sm">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground mr-1" />
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="h-8 w-36 text-xs"
                        />
                        <span className="text-muted-foreground">-</span>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="h-8 w-36 text-xs"
                        />
                    </div>
                    <Button onClick={handleExport} className="gap-2 shadow-md hover:scale-105 transition-transform">
                        <Download className="h-4 w-4" /> Export Map
                    </Button>
                </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg h-[650px]">
                {isLoading && (
                    <div className="absolute z-[400] inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                )}

                {/* We capture this specific div to avoid capturing empty space if window resizes */}
                <div className="h-full w-full bg-slate-100" ref={mapRef}>
                    <MapContainer
                        center={[20.5937, 78.9629]} // Default to center of India
                        zoom={5}
                        scrollWheelZoom={true}
                        className="h-full w-full z-0"
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        <MapBoundsFitter mapData={groupedData} />

                        {!isLoading && groupedData.map((group: any[], index: number) => {
                            const main = group[0];
                            return (
                                <Marker
                                    key={main.id || index}
                                    position={[main.lat, main.lng]}
                                    icon={createCustomIcon(group)}
                                >
                                    <Popup className="rounded-xl font-sans custom-popup p-0 border-0 shadow-lg">
                                        <div className="p-1 min-w-[220px] max-w-[260px] max-h-[350px] overflow-y-auto scrollbar-thin">
                                            <div className="sticky top-0 bg-white z-10 border-b pb-2 mb-2 pt-1">
                                                <h3 className="font-extrabold text-sm text-primary flex items-center gap-2">
                                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-xs">
                                                        {group.length}
                                                    </span>
                                                    {group.length === 1 ? 'Order at this Location' : 'Orders at this Location'}
                                                </h3>
                                            </div>

                                            <div className="space-y-3">
                                                {group.map((order: any, i: number) => (
                                                    <div key={order.id || i} className="border-b last:border-0 pb-3 last:pb-1">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <img
                                                                    src={order.customerImage || `https://ui-avatars.com/api/?name=${order.customerName || 'U'}&background=random`}
                                                                    className="w-8 h-8 rounded-full border border-gray-200 object-cover"
                                                                    alt={order.customerName}
                                                                />
                                                                <div>
                                                                    <p className="font-bold text-xs text-gray-900 leading-tight line-clamp-1">{order.customerName}</p>
                                                                    <p className="text-[10px] text-gray-500">{order.customerMobile}</p>
                                                                </div>
                                                            </div>
                                                            <span className="bg-primary/10 text-primary uppercase text-[9px] font-bold px-1.5 py-0.5 rounded border border-primary/20 shadow-sm">
                                                                #{order.customId}
                                                            </span>
                                                        </div>

                                                        <div className="flex justify-between items-center bg-gray-50 rounded-lg p-2 border border-gray-100">
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">Amount</span>
                                                                <span className="font-bold text-xs text-gray-800">₹{(order.amount || 0).toFixed(2)}</span>
                                                            </div>
                                                            <div className="flex flex-col text-right">
                                                                <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">Status</span>
                                                                <span className={`text-[10px] font-extrabold ${order.status === 'DELIVERED' ? 'text-green-600' : order.status === 'CANCELLED' ? 'text-red-600' : 'text-blue-600'}`}>
                                                                    {order.status}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="mt-1.5 text-right px-1">
                                                            <span className="text-[10px] font-medium text-gray-400">
                                                                {new Date(order.createdAt).toLocaleString('en-IN', {
                                                                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                                                                })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
}
