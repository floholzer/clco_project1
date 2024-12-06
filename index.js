const pulumi = require("@pulumi/pulumi");
const azure = require("@pulumi/azure-native");

// Configuration variables
const location = "northeurope";
const vnetAddressSpace = "10.0.0.0/16";
const subnetAddressPrefix = "10.0.1.0/24";
const dnsZoneName = "privatelink.cognitiveservices.azure.com";
const cognitiveServiceKind = "TextAnalytics";
const appServicePlanSku = { name: "P1v2", tier: "PremiumV2", size: "P1v2", capacity: 3 };
const pythonVersion =  "PYTHON|3.9";

// Resource Group
const resourceGroup = new azure.resources.ResourceGroup("resourceGroup", {
    location: location,
});

// Virtual Network
const virtualNetwork = new azure.network.VirtualNetwork("virtualNetwork", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    addressSpace: { addressPrefixes: [vnetAddressSpace] },
});

// Subnet
const subnet = new azure.network.Subnet("subnet", {
    resourceGroupName: resourceGroup.name,
    virtualNetworkName: virtualNetwork.name,
    addressPrefix: subnetAddressPrefix,
    privateEndpointNetworkPolicies: "Disabled",
});

// Private DNS Zone
const privateDnsZone = new azure.network.PrivateZone("privateDnsZone", {
    resourceGroupName: resourceGroup.name,
    location: "global",
    privateZoneName: dnsZoneName,
});

// Virtual Network Link to DNS Zone
const vnetLink = new azure.network.VirtualNetworkLink("vnetLink", {
    resourceGroupName: resourceGroup.name,
    privateZoneName: privateDnsZone.name,
    virtualNetwork: { id: virtualNetwork.id },
    registrationEnabled: false,
});

// Cognitive Services Account
const cognitiveAccount = new azure.cognitiveservices.Account("cognitiveAccount", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    kind: cognitiveServiceKind,
    sku: { name: "S0" },
    properties: {
        networkAcls: {
            defaultAction: "Deny",
            virtualNetworkRules: [{ id: subnet.id }],
        },
    },
});

// Private Endpoint for Cognitive Services
const cognitivePrivateEndpoint = new azure.network.PrivateEndpoint("cognitivePrivateEndpoint", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    subnet: { id: subnet.id },
    privateLinkServiceConnections: [{
        name: "cognitiveServiceConnection",
        privateLinkServiceId: cognitiveAccount.id,
        groupIds: ["cognitiveservices"],
    }],
});

// DNS A Record for Cognitive Services Private Endpoint
const cognitiveDnsRecord = new azure.network.RecordSet("cognitiveDnsRecord", {
    resourceGroupName: resourceGroup.name,
    zoneName: privateDnsZone.name,
    relativeRecordSetName: "cognitiveservices",
    recordType: "A",
    ttl: 3600,
    aRecords: [{ ipv4Address: cognitivePrivateEndpoint.privateIpAddress }],
});

// App Service Plan
const appServicePlan = new azure.web.AppServicePlan("appServicePlan", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    sku: appServicePlanSku,
    kind: "Linux",
    reserved: true,
});

// Web App
const webApp = new azure.web.WebApp("webApp", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    serverFarmId: appServicePlan.id,
    siteConfig: {
        linuxFxVersion: pythonVersion,
        vnetRouteAllEnabled: true,
        scmType: "LocalGit",
    },
    httpsOnly: true,
});

// App Settings Configuration
const appSettings = new azure.web.WebAppApplicationSettings("appSettings", {
    resourceGroupName: resourceGroup.name,
    name: webApp.name,
    properties: {
        "COGNITIVE_SERVICE_ENDPOINT": cognitiveAccount.endpoint,
        "COGNITIVE_SERVICE_KEY": cognitiveAccount.listKeys().primaryKey,
    },
});

// Export Outputs
exports.resourceGroupName = resourceGroup.name;
exports.virtualNetworkName = virtualNetwork.name;
exports.subnetName = subnet.name;
exports.privateDnsZoneName = privateDnsZone.name;
exports.cognitiveAccountName = cognitiveAccount.name;
exports.webAppName = webApp.name;
