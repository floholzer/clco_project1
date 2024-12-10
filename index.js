const pulumi = require("@pulumi/pulumi");
const azure = require("@pulumi/azure-native");

// Configuration
const location = "eastus";
const repoUrl = "https://github.com/dmelichar/clco-demo";
const branch = "main";

// Resource Group
const resourceGroup = new azure.resources.ResourceGroup("resourceGroup", {
    location,
});

// Virtual Network
const virtualNetwork = new azure.network.VirtualNetwork("myVNet", {
    resourceGroupName: resourceGroup.name,
    location,
    addressSpace: {
        addressPrefixes: ["10.0.0.0/16"],
    },
});

// Subnet for App Service
const appSubnet = new azure.network.Subnet("appSubnet", {
    resourceGroupName: resourceGroup.name,
    virtualNetworkName: virtualNetwork.name,
    addressPrefix: "10.0.0.0/24",
    delegations: [{
        name: "delegation",
        serviceName: "Microsoft.Web/serverfarms",
    }],
    privateEndpointNetworkPolicies: "Enabled",
});

// Subnet for Private Endpoint
const endpointSubnet = new azure.network.Subnet("endpointSubnet", {
    resourceGroupName: resourceGroup.name,
    virtualNetworkName: virtualNetwork.name,
    addressPrefix: "10.0.1.0/24",
    privateEndpointNetworkPolicies: "Disabled",
});

// DNS Zone
const dnsZone = new azure.network.PrivateZone("dnsZone", {
    privateZoneName: "privatelink.cognitiveservices.azure.com",
    resourceGroupName: resourceGroup.name,
    location: "global",
});

// Cognitive Services Account
const languageAccount = new azure.cognitiveservices.Account("myLanguageService", {
    resourceGroupName: resourceGroup.name,
    location,
    kind: "TextAnalytics",
    sku: { name: "F0" },
    identity: { type: "SystemAssigned" },
    publicNetworkAccess: "Disabled",
    customSubDomainName: "DziHolLanguageService",
});

// Account Keys Output
const accountKeys = pulumi.output(azure.cognitiveservices.listAccountKeys({
    resourceGroupName: resourceGroup.name,
    accountName: languageAccount.name,
}));

// Virtual Network Link
const dnsZoneVirtualNetworkLink = new azure.network.VirtualNetworkLink("dnsZoneVirtualNetworkLink", {
    resourceGroupName: resourceGroup.name,
    privateZoneName: dnsZone.name,
    location: "global",
    virtualNetwork: {
        id: virtualNetwork.id,
    },
    registrationEnabled: false,
});

// Private Endpoint
const privateEndpoint = new azure.network.PrivateEndpoint("privateEndpoint", {
    resourceGroupName: resourceGroup.name,
    location,
    subnet: {
        id: endpointSubnet.id,
    },
    privateLinkServiceConnections: [{
        name: "languageServiceConnection",
        privateLinkServiceId: languageAccount.id,
        groupIds: ["account"],
    }],
}, {
    dependsOn: [languageAccount], // Abhängigkeit hinzufügen
});

// Private DNS Zone Group
const privateDnsZoneGroup = new azure.network.PrivateDnsZoneGroup("privateDnsZoneGroup", {
    resourceGroupName: resourceGroup.name,
    privateEndpointName: privateEndpoint.name,
    privateDnsZoneConfigs: [{
        name: "config",
        privateDnsZoneId: dnsZone.id,
    }],
});

// App Service Plan
const appServicePlan = new azure.web.AppServicePlan("appServicePlan", {
    resourceGroupName: resourceGroup.name,
    location,
    sku: {
        capacity: 3,
        name: "B1",
        tier: "Basic",
    },
    kind: "linux",
    reserved: true,
});

// App Service
const webApp = new azure.web.WebApp("webApp", {
    resourceGroupName: resourceGroup.name,
    location,
    serverFarmId: appServicePlan.id,
    httpsOnly: true,
    kind: "app,linux",
    siteConfig: {
        linuxFxVersion: "PYTHON|3.8",
        appSettings: [
            { name: "AZ_ENDPOINT", value: `https://clcoLanguageService.cognitiveservices.azure.com/` },
            { name: "AZ_KEY", value: accountKeys.keys[0] },
            { name: "WEBSITE_RUN_FROM_PACKAGE", value: "0" },
        ],
        alwaysOn: true,
        ftpsState: "Disabled",
    },
});

// VNet Integration
const vnetIntegration = new azure.web.WebAppSwiftVirtualNetworkConnection("vnetIntegration", {
    name: webApp.name,
    resourceGroupName: resourceGroup.name,
    subnetResourceId: appSubnet.id,
});

// Source Control
const sourceControl = new azure.web.WebAppSourceControl("sourceControl", {
    name: webApp.name,
    resourceGroupName: resourceGroup.name,
    repoUrl,
    branch,
    isManualIntegration: true,
    deploymentRollbackEnabled: false,
    isGitHubAction: false,
});

// Budget
const budget = new azure.costmanagement.Budget("myBudget2", {
    scope: "/subscriptions/f12b721a-38e7-4d35-a686-0af70d663353",
    amount: 5,
    category: "Cost",
    timeGrain: "Monthly",
    timePeriod: {
        startDate: "2024-12-01T00:00:00Z",
        endDate: "2025-12-31T00:00:00Z",
    },
    notifications: {
        Actual_GreaterThan_80_Percent: {
            enabled: true,
            operator: "GreaterThan",
            threshold: 80,
            contactEmails: ["wi22b004@technikum-wien.at"],
            thresholdType: "Actual",
        },
        Forecasted_GreaterThan_100_Percent: {
            enabled: true,
            operator: "GreaterThan",
            threshold: 100,
            contactEmails: ["wi22b004@technikum-wien.at"],
            thresholdType: "Forecasted",
        },
    },
});