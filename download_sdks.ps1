# JoPACC Open Finance SDK Downloader
# Downloads all OpenAPI specifications from the JoPACC Developer Portal

$BaseUrl = "https://jpcjofsdev.devportal-az-eu.webmethods.io/portal"
$ApiListUrl = "$BaseUrl/rest/v1/apis"
$OutputDir = "c:\Users\Lenovo\Downloads\مشروع_بحث\sdks\jopacc-open-finance"

# Create output directory
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Force -Path "$OutputDir\openapi-specs" | Out-Null
New-Item -ItemType Directory -Force -Path "$OutputDir\raml-specs" | Out-Null

Write-Host "=== JoPACC Open Finance SDK Downloader ===" -ForegroundColor Cyan
Write-Host "Fetching API list from portal..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $ApiListUrl -Method Get -ContentType "application/json"
    $apis = $response.result
    
    Write-Host "Found $($apis.Count) APIs on the portal" -ForegroundColor Green
    Write-Host ""
    
    # Track all APIs info for summary
    $apiSummary = @()
    
    foreach ($api in $apis) {
        $apiName = $api.name
        $apiVersion = $api.version
        $apiType = $api.type
        $apiId = $api.id
        
        Write-Host "--- Processing: $apiName ($apiVersion) [$apiType] ---" -ForegroundColor Cyan
        
        $apiInfo = @{
            Name = $apiName
            Version = $apiVersion
            Type = $apiType
            Id = $apiId
            Files = @()
        }
        
        # Download attachments (OpenAPI JSON and RAML files)
        if ($api.attachments) {
            foreach ($attachment in $api.attachments) {
                $fileName = $attachment.name
                $fileUri = $attachment.uri
                $downloadUrl = "$BaseUrl$fileUri"
                
                # Determine output subdirectory
                if ($fileName -match "\.json$") {
                    $outPath = "$OutputDir\openapi-specs\$fileName"
                } elseif ($fileName -match "\.raml$") {
                    $outPath = "$OutputDir\raml-specs\$fileName"
                } else {
                    $outPath = "$OutputDir\$fileName"
                }
                
                Write-Host "  Downloading: $fileName" -ForegroundColor White
                try {
                    Invoke-WebRequest -Uri $downloadUrl -OutFile $outPath -UseBasicParsing
                    Write-Host "  -> Saved: $outPath" -ForegroundColor Green
                    $apiInfo.Files += $fileName
                } catch {
                    Write-Host "  -> FAILED: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        }
        
        $apiSummary += $apiInfo
        Write-Host ""
    }
    
    # Generate summary JSON
    $summaryPath = "$OutputDir\api-catalog.json"
    $summaryData = @{
        portal = $BaseUrl
        downloadDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        totalApis = $apis.Count
        apis = $apiSummary
    }
    $summaryData | ConvertTo-Json -Depth 5 | Set-Content -Path $summaryPath -Encoding UTF8
    Write-Host "=== Summary saved to: $summaryPath ===" -ForegroundColor Green
    
    # Also save the full API metadata
    $metadataPath = "$OutputDir\full-api-metadata.json"
    $response | ConvertTo-Json -Depth 10 | Set-Content -Path $metadataPath -Encoding UTF8
    Write-Host "=== Full metadata saved to: $metadataPath ===" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "=== Download Complete ===" -ForegroundColor Cyan
    Write-Host "Total APIs: $($apis.Count)" -ForegroundColor White
    Write-Host "OpenAPI specs: $OutputDir\openapi-specs" -ForegroundColor White
    Write-Host "RAML specs: $OutputDir\raml-specs" -ForegroundColor White
    
    # List all API names
    Write-Host ""
    Write-Host "=== APIs Downloaded ===" -ForegroundColor Cyan
    foreach ($info in $apiSummary) {
        Write-Host "  - $($info.Name) ($($info.Version)) - Files: $($info.Files -join ', ')" -ForegroundColor White
    }
    
} catch {
    Write-Host "Error fetching API list: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
