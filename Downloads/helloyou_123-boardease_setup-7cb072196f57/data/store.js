import { boardingHouses as initialListings } from './mockData';

let listings = [...initialListings];
const listeners = new Set();

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const listingsStore = {
  getListings: () => listings,
  addListing: (listing) => {
    listings.unshift(listing); // Add to the beginning of the array
    notify();
  },
  deleteListing: (id) => {
    listings = listings.filter(l => l.id !== id);
    notify();
  },
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener); // Return an unsubscribe function
  },
};