const pulumi = require("@pulumi/pulumi");
const azure = require("@pulumi/azure-native");

// Configuration variables
const resourceGroupName = "clco_project1";
const location = "westus";
const SC_BRANCH = "main";
const SC_URL = "https://github.com/floholzer/clco-demo";
const budgetScope = "/subscriptions/baf14dc0-aa90-480a-a428-038a6943c5b3"; // Subscription ID of Holzer's Azure Account


// Resource Group erstellen
const resourceGroup = new azure.resources.ResourceGroup(resourceGroupName, {
    location: location,
});

// Virtuelles Netzwerk erstellen
const vnet = new azure.network.VirtualNetwork("vnet", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    addressSpace: {addressPrefixes: ["10.0.0.0/16"]},
});

// WebApp Subnet erstellen
const appSubnet = new azure.network.Subnet("appSubnet", {
    resourceGroupName: resourceGroup.name,
    virtualNetworkName: vnet.name,
    addressPrefix: "10.0.2.0/24",
    delegations: [{
        name: "delegation",
        serviceName: "Microsoft.Web/serverFarms",
    }],
    privateEndpointNetworkPolicies: "Enabled",
});

// PrivateEndpoint Subnet erstellen
const endPointSubnet = new azure.network.Subnet("endPointSubnet", {
    resourceGroupName: resourceGroup.name,
    virtualNetworkName: vnet.name,
    addressPrefix: "10.0.1.0/24",
    privateEndpointNetworkPolicies: "Disabled",
});

// Private DNS Zone
const privateDnsZone = new azure.network.PrivateZone("privateDnsZone", {
    resourceGroupName: resourceGroup.name,
    location: "Global",
    privateZoneName: "privatelink.cognitiveservices.azure.com",
});

// Cognitive Services Account
const cognitiveAccount = new azure.cognitiveservices.Account("cognitiveAccount", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    kind: "TextAnalytics",
    sku: {name: "F0"},
    properties: {
        publicNetworkAccess: "Disabled",
        customSubDomainName: "DzHoLanguageService",
    },
});

// Private Endpoint für Cognitive Service erstellen
const privateEndpoint = new azure.network.PrivateEndpoint("privateEndpoint", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    subnet: {id: endPointSubnet.id},
    privateLinkServiceConnections: [{
        name: "cognitiveServiceConnection",
        privateLinkServiceId: cognitiveAccount.id,
        groupIds: ["account"],
    }],
});

const privateDnsZoneGroup = new azure.network.PrivateDnsZoneGroup("privateDnsZoneGroup", {
    resourceGroupName: resourceGroup.name,
    privateEndpointName: privateEndpoint.name,
    privateDnsZoneConfigs: [{
        name: privateDnsZone.name + "-config",
        privateDnsZoneId: privateDnsZone.id,
    }],
});

// Virtual Network Link to DNS Zone
const vnetLink = new azure.network.VirtualNetworkLink("vnet-link", {
    resourceGroupName: resourceGroup.name,
    privateZoneName: privateDnsZone.name,
    location: "global",
    virtualNetwork: {id: vnet.id},
    registrationEnabled: false,
});

// App Service Plan
const appServicePlan = new azure.web.AppServicePlan("appServicePlan", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    sku: {
        name: "B1",
        tier: "Basic",
        capacity: 3, // 3 instances
    },
    kind: "linux",
    reserved: true,
});

// Cognitive Account Keys
const accountKeys = azure.cognitiveservices.listAccountKeysOutput({
    resourceGroupName: resourceGroup.name,
    accountName: cognitiveAccount.name,
})

// Web App
const webApp = new azure.web.WebApp("WebApp", {
    name: "DzHo-Webapp",
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    serverFarmId: appServicePlan.id,
    kind: "app,linux",
    httpsOnly: true,
    virtualNetworkSubnetId: appSubnet.id,
    siteConfig: {
        linuxFxVersion: "PYTHON|3.9",
        alwaysOn: true,
        ftpsState: "Disabled",
        appSettings: [{
            name: "AZ_ENDPOINT", value: cognitiveAccount.properties.endpoint,
        }, {
            name: "AZ_KEY", value: accountKeys.apply(keys => keys.key1),
        }, {
            name: "WEBSITE_RUN_FROM_PACKAGE", value: "0",
        }],
    },
});

// add Source Control
const sourceControl = new azure.web.WebAppSourceControl("SourceControl", {
    name: webApp.name,
    resourceGroupName: resourceGroup.name,
    branch: SC_BRANCH,
    repoUrl: SC_URL,
    isManualIntegration: true,
    isGitHubAction: false,
});

// Define a cost-efficient budget
const budget = new azure.consumption.Budget("Project1Budget", {
    scope: budgetScope,
    resourceGroupName: resourceGroup.name,
    amount: 20, // 20$ (USD) budget
    timeGrain: "Monthly",
    timePeriod: {
        startDate: "2024-12-01",
        endDate: "2024-12-31",
    }, category: "Cost",
    notifications: {
        Actual_GreaterThan_80_Percent: {
            contactEmails: ["wi22b090@technikum-wien.at", "wi22b004@technikum-wien.at",],
            enabled: true,
            locale: azure.consumption.CultureCode.En_us,
            operator: azure.consumption.OperatorType.GreaterThan,
            threshold: 80,
            thresholdType: azure.consumption.ThresholdType.Actual,
        }, Forecast_GreaterThan_80_Percent: {
            contactEmails: ["wi22b090@technikum-wien.at", "wi22b004@technikum-wien.at",],
            enabled: true,
            operator: azure.consumption.OperatorType.GreaterThan,
            threshold: 80,
            thresholdType: azure.consumption.ThresholdType.Forecasted,
        },
    },
});

// Export Outputs
exports.resourceGroupName = resourceGroup.name;
exports.virtualNetworkName = vnet.name;
exports.privateDnsZoneName = privateDnsZone.name;
exports.cognitiveAccountName = cognitiveAccount.name;
exports.webAppName = webApp.name;
exports.endpoint = webApp.defaultHostName;
