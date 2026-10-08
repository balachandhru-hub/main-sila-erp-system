import type { Invitation } from "./types";

export const officeFurniture: Invitation = {
    code: "RFQ-1024",
    category: "Office Furniture",
    status: "open",
    title: "Office Furniture",
    company: "ABC Manufacturing",
    description: "Supply and installation of ergonomic office desks, chairs, and conference room layouts for the newly renovated corporate headquarters.",
    closing: "2026-07-25",
};

export const enterpriseLaptops: Invitation = {
    code: "RFQ-1025",
    category: "IT Hardware & Accessories",
    status: "open",
    title: "Enterprise Laptops & Keyboards",
    company: "Global Tech Solutions Inc.",
    description: "Annual replenishment of standard developer workstations, ergonomic mice, mechanical keyboards, and 27-inch monitors.",
    closing: "2026-08-05",
};

export const recycledStationeryAccepted: Invitation = {
    code: "RFQ-1021",
    category: "IT Hardware & Accessories",
    status: "accepted",
    title: "Recycled Stationery Bulk",
    company: "Eco-Friendly Logistics Ltd",
    description: "Corporate-wide distribution of recycled writing pads, notebooks, biodegradable pens, and storage folders.",
    closing: "2026-07-12",
};

export const breakroomSupplies: Invitation = {
    code: "RFQ-1020",
    category: "Breakroom Supplies",
    status: "closed",
    title: "Premium Coffee & Breakroom Amenities",
    company: "Nexus Capital",
    description: "Sourcing high-quality organic coffee beans, tea selection, and eco-friendly disposable mugs for five regional offices.",
    closing: "2026-06-30",
};

export const recycledStationeryDeclined: Invitation = {
    code: "RFQ-1019",
    category: "IT Hardware & Accessories",
    status: "declined",
    title: "Recycled Stationery Bulk",
    company: "Eco-Friendly Logistics Ltd",
    description: "Corporate-wide distribution of recycled writing pads, notebooks, biodegradable pens, and storage folders.",
    closing: "2026-06-07",
};

export const mockInvitations: Invitation[] = [
    officeFurniture,
    enterpriseLaptops,
    recycledStationeryAccepted,
    breakroomSupplies,
    recycledStationeryDeclined,
];
