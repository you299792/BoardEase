// Mock data for development 
export const boardingHouses = [
  {
    id: '1',
    name: 'Sunrise Boarding House',
    price: 3500,
    location: 'Divisoria, Cagayan de Oro',
    rating: 4.5,
    reviews: 128,    
    images: [
      'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=400',
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=400',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400'
    ],
    floorPlans: ['https://example.com/floorplan1.jpg'],
    virtualTourUrl: 'https://example.com/virtual-tour',
    type: 'Single Room',
    amenities: ['WiFi', 'Laundry', 'Kitchen', 'CR', 'Utilities Included'],
    distance: '0.8 km',
    description: 'Cozy single rooms with basic amenities. Perfect for students and working professionals.',
    landlord: {
      name: 'Saul Goodman',
      phone: '09123456789',
      verified: true,
    }
  },
  {
    id: '2',
    name: 'CDO Student Dorm',
    price: 2800,
    location: 'Nazareth, Cagayan de Oro',
    rating: 4.2,
    reviews: 95,    
    images: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400'
    ],
    floorPlans: [],
    virtualTourUrl: null,
    type: 'Shared Room',
    amenities: ['WiFi', 'Study Area', 'CR', '24/7 Security'],
    distance: '1.2 km',
    description: 'Affordable shared accommodation for students near universities.',
    landlord: {
      name: 'Mike Ehrmantraut',
      phone: '09198765432',
      verified: true
    }
  },
  {
    id: '3',
    name: 'Green Valley Apartelle',
    price: 4500,
    location: 'Carmen, Cagayan de Oro',
    rating: 4.8,
    reviews: 203,    
    images: [
      'https://images.unsplash.com/photo-1513584684374-8bab748fbf90?w=400'
    ],
    floorPlans: [],
    virtualTourUrl: null,
    type: 'Studio Unit',
    amenities: ['WiFi', 'Aircon', 'Kitchen', 'CR', 'Parking', 'Pets Allowed'],
    distance: '2.1 km',
    description: 'Modern studio units with complete amenities for comfortable living.',
    landlord: {
      name: 'Gustavo Fring',
      phone: '09151234567',
      verified: true
    }
  },
  {
    id: '4',
    name: 'XU Area Boarding',
    price: 3200,
    location: 'Corrales Ext, Cagayan de Oro',
    rating: 4.3,
    reviews: 87,    
    images: [
      'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=400'
    ],
    floorPlans: [],
    virtualTourUrl: null,
    type: 'Single Room',
    amenities: ['WiFi', 'CR', 'Study Area'],
    distance: '0.5 km',
    description: 'Walking distance to Xavier University. Ideal for students.',
    landlord: {
      name: 'Tuco Salamanca',
      phone: '09159876543',
      verified: false
    }
  },
  {
    id: '5',
    name: 'Downtown Comfort',
    price: 5200,
    location: 'Lapasan, Cagayan de Oro',
    rating: 4.6,
    reviews: 156,    
    images: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=400'
    ],
    floorPlans: [],
    virtualTourUrl: null,
    type: 'Studio Unit',
    amenities: ['WiFi', 'Aircon', 'Kitchen', 'CR', 'Parking', 'Laundry'],
    distance: '1.8 km',
    description: 'Premium studio units with complete facilities and security.',
    landlord: {
      name: 'Walter White',
      phone: '09157778899',
      verified: true
    }
  }
];

export const notifications = [
  {
    id: '1',
    title: 'New Boarding House Available',
    message: 'Sunrise Boarding House has new rooms available near Xavier University.',
    time: '2 hours ago',
    type: 'new_listing',
    read: false,
    actionable: true,
  },
  {
    id: '2',
    title: 'Booking Confirmed',
    message: 'Your booking at CDO Student Dorm has been confirmed for March 2024.',
    time: '1 day ago',
    type: 'booking',
    read: true,
    actionable: true,
  },
  {
    id: '3',
    title: 'Payment Due Soon',
    message: 'Your monthly payment of ₱3,500 is due in 3 days for Sunrise Boarding.',
    time: '2 days ago',
    type: 'payment',
    read: true,
    actionable: true,
  }
];

export const messages = [
  {
    id: '1',
    landlord: {
      name: 'Saul Goodman',
      image: 'https://media.licdn.com/dms/image/v2/C4D12AQEMLLk06x2Wbw/article-cover_image-shrink_600_2000/article-cover_image-shrink_600_2000/0/1520167327484?e=2147483647&v=beta&t=r-IZtKjxlD6syVp4W8xSThCYNrbiNI6qOrfqjO27qCk',
    },
    lastMessage: 'Where are you? Call me.',
    time: '10:30 AM',
    unread: true
  },
  {
    id: '2',
    landlord: {
      name: 'Mike Ehrmantraut',
      image: 'https://static.wikia.nocookie.net/breakingbad/images/9/9f/Season_4_-_Mike.jpg/revision/latest?cb=20250728074206',
    },
    lastMessage: 'I got the room cleaned for you, kid.',
    time: 'Yesterday',
    unread: false
  },
  {
    id: '3',
    landlord: {
      name: 'Walter White',
      image: 'https://i.pinimg.com/736x/50/4d/ab/504dab425e2cda6b74b3fd57e56baa30.jpg',
    },
    lastMessage: 'Wanna cook?',
    time: 'Yesterday',
    unread: false
  },
  {
    id: '4',
    landlord: {
      name: 'Brandon Mayhew',
      image: 'https://static.wikia.nocookie.net/breakingbad/images/a/ac/Badger_2008.png/revision/latest?cb=20220815164007',
    },
    lastMessage: 'Me: Yo!',
    time: 'Yesterday',
    unread: false
  },
  {
    id: '5',
    landlord: {
      name: 'Skinny Pete',
      image: 'https://static.wikia.nocookie.net/breakingbad/images/e/ea/Skinny_Pete_2009.png/revision/latest?cb=20200611125059',
    },
    lastMessage: 'Be there at noon, yo.',
    time: '2 days ago',
    unread: false
  },
  {
    id: '6',
    landlord: {
      name: 'Skyler White',
      image: 'https://ew.com/thmb/c-e9oofgxwj9jDc9qWm2RLVND1I=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/breaking-bad-anna-gunn-1-101ba7b9fc7443709d9b75e47aeb2e93.jpg',
    },
    lastMessage: 'Well. My name is Skyler White, yo.',
    time: '2 days ago',
    unread: false
  }
];