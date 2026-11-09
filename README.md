# BoardEase

**A Mobile-Based Boarding House Management and Discovery System for Tenants and Landlords**

BoardEase is a mobile application designed to simplify the process of finding, exploring, and managing boarding houses. It provides a platform where tenants can discover available accommodations while landlords can manage their property listings and communicate with potential tenants.

## Features

### Tenant
- **User Authentication** – Register and log in securely.
- **Browse Listings** – Explore available boarding houses.
- **Search and Filter** – Find accommodations based on location, price, and other preferences.
- **Listing Details** – View property descriptions, prices, locations, and images.
- **Favorites** – Save preferred boarding house listings.
- **Messaging** – Communicate directly with landlords.
- **Profile Management** – Manage personal account information.

### Landlord
- **User Authentication** – Register and log in as a landlord.
- **Listing Management** – Create, update, and delete boarding house listings.
- **Image Uploads** – Upload property images.
- **Tenant Communication** – Respond to inquiries through messaging.
- **Profile Management** – Manage landlord account information.

## Technology Stack

### Frontend
- React Native
- Expo SDK 54
- JavaScript
- React Navigation
- React Native Paper
- Axios
- AsyncStorage

### Backend
- Node.js
- Express.js
- Sequelize ORM
- JWT Authentication
- bcrypt

### Database and Cloud Services
- Supabase

## Authentication and Security

BoardEase uses JSON Web Tokens (JWT) to authenticate users and protect restricted API endpoints.

- Passwords are hashed using bcrypt.
- User roles distinguish tenants from landlords.
- Protected routes require valid authentication tokens.
- Environment variables store database and cloud service credentials.

## Sample Data

The tenant home screen includes sample boarding house listings for development and interface testing. These allow the frontend to display accommodation options even when the backend is unavailable.

## Project Objective

BoardEase aims to make boarding house searching and management more accessible and convenient by providing tenants and landlords with a centralized mobile platform for property discovery, listing management, and communication.

---

**BoardEase — Making boarding house search easy, safe, and reliable.**
