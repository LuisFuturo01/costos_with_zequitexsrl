import type { Config } from '../types';

export const calculateHoop = (config: Config, w: number, h: number) => {
  if (!config) return { name: "10x10 cm", cost: 0 };
  
  for (const hoop of config.hoops) {
    if (w <= hoop.max_width && h <= hoop.max_height) {
      return { name: hoop.name, cost: hoop.cost };
    }
  }
  return config.hoops[config.hoops.length - 1];
};

export const calculatePrice = (config: Config, area: number, colors: number, quantity: number = 1) => {
  if (!config) return { subtotal: '0', discount: 0, discountAmount: '0', total: '0', discountName: '', unitPrice: '0' };
  
  const basePrice = config.pricing.base_price;
  const areaPrice = area * config.pricing.price_per_cm2;
  const colorPrice = colors * config.pricing.price_per_color;
  let subtotal = basePrice + areaPrice + colorPrice;
  
  if (subtotal < config.pricing.min_price) {
    subtotal = config.pricing.min_price;
  }
  
  // Calcular descuento
  let discountPercent = 0;
  let discountName = '';
  
  for (const disc of config.discounts) {
    if (quantity >= disc.quantity_min && quantity <= disc.quantity_max) {
      discountPercent = disc.discount;
      discountName = disc.name;
      break;
    }
  }
  
  const discountAmount = (subtotal * discountPercent) / 100;
  const total = (subtotal - discountAmount) * quantity;
  
  return {
    subtotal: subtotal.toFixed(2),
    discount: discountPercent,
    discountAmount: discountAmount.toFixed(2),
    total: total.toFixed(2),
    discountName,
    unitPrice: (subtotal - discountAmount).toFixed(2)
  };
};