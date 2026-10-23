import { WHATSAPP_NUMBER } from '../config.js';

const WHATSAPP_BASE = `https://wa.me/${WHATSAPP_NUMBER}`;

export const messages = {
  hero: "Hello DYNAMIQ, I'd like to know more about your collection.",
};

export function waLink(message) {
  return `${WHATSAPP_BASE}?text=${encodeURIComponent(message)}`;
}

export function phoneHref() {
  return `tel:+${WHATSAPP_NUMBER}`;
}

export function productMessage(product, size, quantity) {
  return `Hello DYNAMIQ, I'd like to order: ${product.name}, Size ${size}, Qty ${quantity}. Please confirm availability and price.`;
}

export function customKitMessage(values) {
  const lines = [
    "Hello DYNAMIQ, I'd like to order a custom team kit.",
    `Team name: ${values.teamName}`,
    `Sport: ${values.sport}`,
    `Quantity: ${values.quantity}`,
    `Customization: ${values.customization}`,
    `City: ${values.city}`,
  ];

  if (values.notes) {
    lines.push(`Notes: ${values.notes}`);
  }

  lines.push('Please confirm availability and price.');
  return lines.join('\n');
}
