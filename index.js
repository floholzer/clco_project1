const pulumi = require("@pulumi/pulumi");
const azure = require("@pulumi/azure-native");

// Configuration variables
const resourceGroupName = "clco_project1";
const location = "northeurope";
const appServicePlanSku = {name: "B1", tier: "Basic", size: "B1", capacity: 3};
const pythonVersion = "PYTHON|3.8";
const SC_BRANCH ="main";
const SC_URL = "https://github.com/dmelichar/clco-demo.git";
const webAppName = "project1";



// Resource Group erstellen
const resourceGroup = new azure.resources.ResourceGroup(resourceGroupName, {
    location: location,
});

// Virtuelles Netzwerk erstellen
const vnet = new azure.network.VirtualNetwork("vnet", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    addressSpace: {addressPrefixes: ["10.0.0.0/16"]},
    subnets: [
        {
            name: "webAppSubnet",
            addressPrefix: "10.0.1.0/24",
        },
        {
            name: "cognitivSubnet",
            addressPrefix: "10.0.2.0/24",
        },
    ],
});

// Private DNS Zone
const privateDnsZone = new azure.network.PrivateZone("privateDnsZone", {
    resourceGroupName: resourceGroup.name,
    location: "global",
    privateZoneName: "privatelink.cognitiveservices.azure.com",
});

// Virtual Network Link to DNS Zone
const vnetLink = new azure.network.VirtualNetworkLink(`${vnet}-link`, {
    resourceGroupName: resourceGroup.name,
    privateZoneName: privateDnsZone.name,
    virtualNetwork: {id: vnet.id},
    registrationEnabled: true,
});

// Cognitive Services Account
const cognitiveAccount = new azure.cognitiveservices.Account("cognitiveAccount", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    identity: {
        type: azure.cognitiveservices.ResourceIdentityType.SystemAssigned,
    },
    kind: "TextAnalytics",
    sku: {name: "S"},
    properties: {
        networkAcls: {
            defaultAction: "Deny",
            virtualNetworkRules: [{
                id: vnet.subnets[1].id,
            }],
        }
    },
});

// Private Endpoint for Cognitive Services
const privateEndpoint = new azure.network.PrivateEndpoint(`${cognitiveAccount.name}-endpoint`, {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    subnet: {id: vnet.subnets[1].id},
    privateLinkServiceConnections: [{
        name: `${cognitiveAccount.name}-connection`,
        privateLinkServiceId: cognitiveAccount.id,
        groupIds: ["cognitiveservices"],
    }],
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
const webApp = new azure.web.WebApp(`${webAppName}-WebApp`, {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    serverFarmId: appServicePlan.id,
    httpsOnly: true,
    siteConfig: {
        linuxFxVersion: pythonVersion,
        vnetRouteAllEnabled: true,
        scmType: "LocalGit",
        virtualNetworkSubnetId: vnet.subnets[0].id,
        virtualApplications: [{
            virtualPath: "/",
            physicalPath: "site\\wwwroot",
            preloadEnabled: true,
        }],
    },
});

// Configure App Settings with Cognitive Services Endpoint and Key
const appSettings = new azure.web.WebAppApplicationSettings(`${webAppName}-AppSettings`, {
    resourceGroupName: resourceGroup.name,
    name: webApp.name,
    properties: {
        "COGNITIVE_ENDPOINT": cognitiveAccount.endpoint,
        "COGNITIVE_KEY": cognitiveAccount.key1,
    },
});

// add Source Control
const sourceControl = new azure.web.WebAppSourceControl(`${webAppName}-SC`, {
    name: webApp.name,
    resourceGroupName: resourceGroup.name,
    branch: SC_BRANCH,
    repoUrl: SC_URL,
    isManualIntegration: true,
    isGitHubAction: false,
});

// Export Outputs
exports.resourceGroupName = resourceGroup.name;
exports.virtualNetworkName = vnet.name;
exports.webAppSubnet = vnet.subnets[0].name;
exports.cognitivSubnet = vnet.subnets[1].name;
exports.privateDnsZoneName = privateDnsZone.name;
exports.cognitiveAccountName = cognitiveAccount.name;
exports.webAppName = webApp.name;
