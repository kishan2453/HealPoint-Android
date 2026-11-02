const fs = require('fs');
let code = fs.readFileSync('HealPointBackend/controllers/emergencyController.js', 'utf8');

// 1. In createEmergencyRequest: ensure isDemo: true, isSimulation: true, and static demo location
const oldCreation = `    const newEmergency = new EmergencyRequest({
      patientId,
      hospitalId: targetHospitalId,
      emergencyType,
      severity,
      notes,
      location: {
        latitude: location.latitude ? Number(location.latitude) : undefined,
        longitude: location.longitude ? Number(location.longitude) : undefined,
        address: location.address || "Location coordinates shared",
        accuracy: location.accuracy ? Number(location.accuracy) : undefined,
        sharedAt: new Date(),
      },`;

const newCreation = `    // Standalone Demo Mode: Enforce simulation flags and anonymized static coordinates
    const isDemo = true;
    const isSimulation = true;
    // Anonymize GPS to prevent real location leakage (Demo Healthcare Hub)
    const simulatedLocation = {
      latitude: 23.0225,
      longitude: 72.5714,
      address: location.address ? \`[DEMO LOCATION] \${location.address.replace(/[0-9]{6}/g, '000000')}\` : "HealPoint Demo Healthcare Hub, Ahmedabad (Simulated Demo Coordinates)",
      accuracy: 10,
      sharedAt: new Date(),
    };

    const newEmergency = new EmergencyRequest({
      isDemo: true,
      isSimulation: true,
      patientId,
      hospitalId: targetHospitalId,
      emergencyType,
      severity,
      notes,
      location: simulatedLocation,`;

if (code.includes(oldCreation)) {
  code = code.replace(oldCreation, newCreation);
}

// 2. In createEmergencyRequest: replace success message
const oldMsg = `message: "Emergency SOS activated. Response teams have been notified.",`;
const newMsg = `message: "DEMO MODE: This is a simulated emergency request. No real hospital, ambulance or emergency service has been contacted.",\n      isDemo: true,\n      isSimulation: true,`;
if (code.includes(oldMsg)) {
  code = code.replace(oldMsg, newMsg);
}

// 3. In dispatchAmbulance: ensure simulated ambulance info and warning
const oldAmbDispatched = `      dispatchedAt: new Date(),
    };`;
const newAmbDispatched = `      dispatchedAt: new Date(),
      isDemo: true,
      isSimulation: true,
    };
    emergency.isDemo = true;
    emergency.isSimulation = true;`;
if (code.includes(oldAmbDispatched)) {
  code = code.replace(oldAmbDispatched, newAmbDispatched);
}

const oldAmbMsg = `message: "Ambulance dispatched successfully and patient notified.",`;
const newAmbMsg = `message: "DEMO MODE: Ambulance dispatch simulated. No real hospital or ambulance has been contacted.",\n      isDemo: true,\n      isSimulation: true,`;
if (code.includes(oldAmbMsg)) {
  code = code.replace(oldAmbMsg, newAmbMsg);
}

fs.writeFileSync('HealPointBackend/controllers/emergencyController.js', code, 'utf8');
console.log('emergencyController.js successfully updated for 100% demo simulation');
