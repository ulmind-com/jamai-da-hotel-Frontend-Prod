import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/axios";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    Legend,
} from "recharts";
import { Calendar, TrendingUp, Users, DollarSign, ShoppingBag, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, subDays } from "date-fns";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

interface AnalyticsData {
    period: { startDate: string; endDate: string };
    revenue: number;
    paidOrdersCount: number;
    totalOrders: number;
    newUsersCount: number;
    newUsers: Array<{
        _id: string;
        name: string;
        email: string;
        mobile: string;
        profileImage?: string;
        createdAt: string;
    }>;
    topItems: Array<{
        _id: string;
        name: string;
        totalSold: number;
        revenue: number;
        imageURL: string;
    }>;
    statusBreakdown: Record<string, number>;
}

const DashboardAnalytics = () => {
    const [dateRange, setDateRange] = useState({
        startDate: format(new Date(), "yyyy-MM-dd") + "T00:00",
        endDate: format(new Date(), "yyyy-MM-dd") + "T23:59",
    });

    const { data: analytics, isLoading } = useQuery<AnalyticsData>({
        queryKey: ["admin-analytics", dateRange],
        queryFn: () => adminApi.getAnalytics(dateRange).then((r) => r.data),
    });

    const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDateRange((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    if (isLoading) {
        return <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
            <Skeleton className="h-96 rounded-xl" />
        </div>;
    }

    const statusData = analytics?.statusBreakdown
        ? Object.entries(analytics.statusBreakdown).map(([name, value]) => ({ name, value }))
        : [];

    const topItemsData = analytics?.topItems || [];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Advanced Analytics</h2>
                        <p className="text-xs text-muted-foreground">Deep dive into your business metrics</p>
                    </div>
                </div>
                <div className="flex w-full flex-col sm:w-auto sm:flex-row items-center gap-2">
                    <div className="relative w-full sm:w-auto">
                        <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="datetime-local"
                            name="startDate"
                            value={dateRange.startDate}
                            onChange={handleRangeChange}
                            className="h-10 rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
                        />
                    </div>
                    <span className="hidden text-muted-foreground sm:block">-</span>
                    <div className="relative w-full sm:w-auto">
                        <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="datetime-local"
                            name="endDate"
                            value={dateRange.endDate}
                            onChange={handleRangeChange}
                            className="h-10 rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    icon={DollarSign}
                    label="Total Revenue"
                    value={`₹${Number(analytics?.revenue || 0).toFixed(2)}`}
                    color="text-green-600"
                    bgColor="bg-green-100"
                />
                <MetricCard
                    icon={ShoppingBag}
                    label="Total Orders"
                    value={analytics?.totalOrders || 0}
                    color="text-blue-600"
                    bgColor="bg-blue-100"
                />

                {/* Interactive New Users Card */}
                <Dialog>
                    <DialogTrigger asChild>
                        <div className="cursor-pointer transition-transform hover:scale-105">
                            <MetricCard
                                icon={Users}
                                label="New Users"
                                value={analytics?.newUsersCount || 0}
                                color="text-purple-600"
                                bgColor="bg-purple-100"
                                actionIcon={Eye}
                            />
                        </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>New Users ({analytics?.newUsersCount || 0})</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-[300px] w-full pr-4">
                            <div className="space-y-4">
                                {analytics?.newUsers?.length === 0 ? (
                                    <p className="py-4 text-center text-muted-foreground">No new users in this period.</p>
                                ) : (
                                    analytics?.newUsers.map((user) => (
                                        <div key={user._id} className="flex items-center gap-3 border-b border-border pb-3 last:border-0">
                                            <Avatar>
                                                <AvatarImage src={user.profileImage} />
                                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium text-foreground">{user.name}</p>
                                                <p className="text-xs text-muted-foreground">{user.email}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>

                <MetricCard
                    icon={TrendingUp}
                    label="Paid Orders"
                    value={analytics?.paidOrdersCount || 0}
                    color="text-orange-600"
                    bgColor="bg-orange-100"
                />
            </div>

            {/* Charts Row 1 */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Top Selling Items */}
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm min-w-0">
                    <h3 className="mb-4 text-lg font-bold text-foreground">Top Selling Items</h3>
                    <div className="w-full overflow-x-auto pb-4">
                        <div className="h-[300px] min-w-[500px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topItemsData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        cursor={{ fill: 'transparent' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="totalSold" name="Units Sold" fill="#0088FE" radius={[0, 4, 4, 0]} barSize={20} />
                                    <Bar dataKey="revenue" name="Revenue" fill="#00C49F" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Order Status Breakdown */}
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm min-w-0">
                    <h3 className="mb-4 text-lg font-bold text-foreground">Order Status Distribution</h3>
                    <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
                        <div className="h-[250px] w-full max-w-[250px] flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Custom Legend */}
                        <div className="flex w-full flex-col gap-3">
                            {statusData.map((entry, index) => {
                                const total = statusData.reduce((acc, curr) => acc + curr.value, 0);
                                const percent = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;

                                return (
                                    <div key={entry.name} className="flex items-center justify-between rounded-lg bg-muted/30 p-2">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="h-3 w-3 rounded-full"
                                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                            />
                                            <span className="text-sm font-medium text-foreground">{entry.name.replace(/_/g, " ")}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-bold text-foreground">{entry.value}</span>
                                            <span className="w-12 text-right text-xs text-muted-foreground">{percent}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ icon: Icon, label, value, color, bgColor, actionIcon: ActionIcon }: any) => (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md h-full">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <div className="flex items-center gap-2">
                    <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
                    {ActionIcon && <ActionIcon className="h-4 w-4 text-muted-foreground opacity-50" />}
                </div>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bgColor} ${color}`}>
                <Icon className="h-6 w-6" />
            </div>
        </div>
    </div>
);

export default DashboardAnalytics;
