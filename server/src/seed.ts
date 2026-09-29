import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

async function seed() {
    if (!process.env.MONGODB_URI)
        throw new Error('MONGODB_URI is required');
    await mongoose.connect(process.env.MONGODB_URI);

    const database = mongoose.connection.db;
    if (!database) throw new Error('Database connection unavailable');
    const password = await bcrypt.hash('ServiceHubDemo2025!', 12);
    await database.collection('users').deleteMany({ email: { $in: ['admin@servicehub.com', 'provider@servicehub.com', 'user@servicehub.com'] } });
    
    const users = await database.collection('users').insertMany([
        { name: 'Service Hub Admin', email: 'admin@servicehub.com', role: 'admin', password },
        { name: 'Aarav Services', email: 'provider@servicehub.com', role: 'provider', city: 'Pune', password },
        { name: 'Demo Customer', email: 'user@servicehub.com', role: 'customer', city: 'Pune', password }
    ]);
    await database.collection('categories').deleteMany({});
    await database.collection('categories').insertMany(['Home repair', 'Cleaning', 'Auto care', 'Wellness', 'Tutoring', 'Moving', 'Electrician', 'Photographer', 'Saloon', 'Grocery', 'Electrical services'].map((name) => (
        { name, isActive: true })));
    await database.collection('cities').deleteMany({});
    await database.collection('cities').insertMany(['Mumbai', 'Pune', 'Kolhapur', 'Bengaluru', 'Hyderabad', 'Delhi', 'Chennai', 'Nashik', 'Nagpur', 'Goa'].map((name) => ({ name, country: 'India', isPopular: ['Pune', 'Mumbai', 'Kolhapur'].includes(name), isActive: true }))); console.log('Seeded demo users, categories, and cities. Demo password: ServiceHubDemo2025!'); await mongoose.disconnect()
}
seed().catch((error) => {
    console.error(error);
    process.exit(1)
})
