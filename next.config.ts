import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // iPhone photos run 3-6MB; receipts shot at high res can be bigger.
  // Default server action body limit (1MB) silently rejects them.
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  // Stock is one page now (/stock). Old stock addresses (bookmarks, habits,
  // earlier links) still land on it.
  async redirects() {
    const toStock = (source: string, destination = "/stock") => ({ source, destination, permanent: false });
    return [
      toStock("/owner/stock/:path*"),
      toStock("/owner/stock"),
      toStock("/owner/suppliers/:path*"),
      toStock("/owner/deliveries/:path*"),
      toStock("/owner/order-pad"),
      toStock("/stock/items/:path*"),
      toStock("/stock/overview"),
      toStock("/stock/alerts"),
      toStock("/stock/location-setup"),
      toStock("/stock/order-pad"),
      toStock("/stock/suppliers/:path*"),
      toStock("/stock/deliveries/:path*"),
      toStock("/stock/locations/:id", "/stock?loc=:id"),
      toStock("/stock/locations", "/stock?tab=cafe"),
      toStock("/staff/stock-count"),
    ];
  },
};

export default nextConfig;
