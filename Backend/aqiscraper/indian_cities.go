package main

// Major Indian cities organized by state for aqi.in scraping.
var indianCities = []IndianCity{
	// Maharashtra
	{"Maharashtra", "Mumbai", "mumbai"},
	{"Maharashtra", "Pune", "pune"},
	{"Maharashtra", "Nagpur", "nagpur"},
	{"Maharashtra", "Thane", "thane"},
	{"Maharashtra", "Nashik", "nashik"},
	{"Maharashtra", "Aurangabad", "aurangabad"},
	{"Maharashtra", "Solapur", "solapur"},
	{"Maharashtra", "Kolhapur", "kolhapur"},
	{"Maharashtra", "Navi Mumbai", "navi-mumbai"},

	// Delhi NCR
	{"Delhi", "Delhi", "delhi"},
	{"Delhi", "New Delhi", "new-delhi"},
	{"Haryana", "Gurgaon", "gurgaon"},
	{"Haryana", "Faridabad", "faridabad"},
	{"Uttar Pradesh", "Noida", "noida"},
	{"Uttar Pradesh", "Ghaziabad", "ghaziabad"},
	{"Uttar Pradesh", "Greater Noida", "greater-noida"},

	// Uttar Pradesh
	{"Uttar Pradesh", "Lucknow", "lucknow"},
	{"Uttar Pradesh", "Kanpur", "kanpur"},
	{"Uttar Pradesh", "Varanasi", "varanasi"},
	{"Uttar Pradesh", "Agra", "agra"},
	{"Uttar Pradesh", "Prayagraj", "prayagraj"},
	{"Uttar Pradesh", "Meerut", "meerut"},

	// Karnataka
	{"Karnataka", "Bengaluru", "bengaluru"},
	{"Karnataka", "Mysuru", "mysuru"},
	{"Karnataka", "Hubli", "hubli"},
	{"Karnataka", "Mangaluru", "mangaluru"},

	// Tamil Nadu
	{"Tamil Nadu", "Chennai", "chennai"},
	{"Tamil Nadu", "Coimbatore", "coimbatore"},
	{"Tamil Nadu", "Madurai", "madurai"},
	{"Tamil Nadu", "Tiruchirappalli", "tiruchirappalli"},
	{"Tamil Nadu", "Salem", "salem"},

	// Telangana
	{"Telangana", "Hyderabad", "hyderabad"},
	{"Telangana", "Warangal", "warangal"},
	{"Telangana", "Nizamabad", "nizamabad"},

	// Andhra Pradesh
	{"Andhra Pradesh", "Visakhapatnam", "visakhapatnam"},
	{"Andhra Pradesh", "Vijayawada", "vijayawada"},
	{"Andhra Pradesh", "Guntur", "guntur"},
	{"Andhra Pradesh", "Tirupati", "tirupati"},

	// West Bengal
	{"West Bengal", "Kolkata", "kolkata"},
	{"West Bengal", "Howrah", "howrah"},
	{"West Bengal", "Durgapur", "durgapur"},
	{"West Bengal", "Asansol", "asansol"},
	{"West Bengal", "Siliguri", "siliguri"},

	// Gujarat
	{"Gujarat", "Ahmedabad", "ahmedabad"},
	{"Gujarat", "Surat", "surat"},
	{"Gujarat", "Vadodara", "vadodara"},
	{"Gujarat", "Rajkot", "rajkot"},
	{"Gujarat", "Gandhinagar", "gandhinagar"},

	// Rajasthan
	{"Rajasthan", "Jaipur", "jaipur"},
	{"Rajasthan", "Jodhpur", "jodhpur"},
	{"Rajasthan", "Udaipur", "udaipur"},
	{"Rajasthan", "Kota", "kota"},
	{"Rajasthan", "Ajmer", "ajmer"},

	// Madhya Pradesh
	{"Madhya Pradesh", "Bhopal", "bhopal"},
	{"Madhya Pradesh", "Indore", "indore"},
	{"Madhya Pradesh", "Jabalpur", "jabalpur"},
	{"Madhya Pradesh", "Gwalior", "gwalior"},

	// Punjab
	{"Punjab", "Ludhiana", "ludhiana"},
	{"Punjab", "Amritsar", "amritsar"},
	{"Punjab", "Jalandhar", "jalandhar"},
	{"Punjab", "Patiala", "patiala"},
	{"Punjab", "Chandigarh", "chandigarh"},

	// Bihar
	{"Bihar", "Patna", "patna"},
	{"Bihar", "Gaya", "gaya"},
	{"Bihar", "Muzaffarpur", "muzaffarpur"},

	// Odisha
	{"Odisha", "Bhubaneswar", "bhubaneswar"},
	{"Odisha", "Cuttack", "cuttack"},
	{"Odisha", "Rourkela", "rourkela"},

	// Kerala
	{"Kerala", "Thiruvananthapuram", "thiruvananthapuram"},
	{"Kerala", "Kochi", "kochi"},
	{"Kerala", "Kozhikode", "kozhikode"},
	{"Kerala", "Thrissur", "thrissur"},

	// Jharkhand
	{"Jharkhand", "Ranchi", "ranchi"},
	{"Jharkhand", "Jamshedpur", "jamshedpur"},
	{"Jharkhand", "Dhanbad", "dhanbad"},

	// Chhattisgarh
	{"Chhattisgarh", "Raipur", "raipur"},
	{"Chhattisgarh", "Bhilai", "bhilai"},

	// Assam
	{"Assam", "Guwahati", "guwahati"},

	// Uttarakhand
	{"Uttarakhand", "Dehradun", "dehradun"},
	{"Uttarakhand", "Haridwar", "haridwar"},

	// Himachal Pradesh
	{"Himachal Pradesh", "Shimla", "shimla"},
	{"Himachal Pradesh", "Dharamshala", "dharamshala"},

	// Goa
	{"Goa", "Panaji", "panaji"},
	{"Goa", "Margao", "margao"},
}
