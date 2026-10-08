# -------------------------------------------------
# VOSOX Backend – ProcurementSuite (.NET 8 microservices)
# One image, six processes: Ocelot gateway (public) +
# Identity / MasterData / Buyer / Supplier APIs + python-backend
# (invoice OCR and buyer assistant) on internal localhost.
# -------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY . .

RUN dotnet publish src/ApiGateWay/OcelotGateway/OcelotGateway.csproj              -c Release -o /app/gateway    /p:UseAppHost=false && \
    dotnet publish src/Platform/Identity/Identity.API/Identity.API.csproj         -c Release -o /app/identity   /p:UseAppHost=false && \
    dotnet publish src/Platform/MasterData/MasterData.API/MasterData.API.csproj   -c Release -o /app/masterdata /p:UseAppHost=false && \
    dotnet publish src/Modules/Buyer/Buyer.API/Buyer.API.csproj                   -c Release -o /app/buyer      /p:UseAppHost=false && \
    dotnet publish src/Modules/Supplier/Supplier.API/Supplier.API.csproj          -c Release -o /app/supplier   /p:UseAppHost=false

# Ocelot loads both files with optional:false — make certain they sit next
# to the gateway dll regardless of SDK content-item defaults.
RUN cp -f src/ApiGateWay/OcelotGateway/ocelot.json \
          src/ApiGateWay/OcelotGateway/ocelot.SwaggerEndPoints.json /app/gateway/

# -------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# python-backend runs on Python 3.12 (its requirements are pinned for it). Both base images are Debian 12, so the interpreter is taken
# from the official python image (the -bookworm tag: the default tag moves to a newer Debian than this base image); the libraries it links against are installed here.
# Tesseract reads scanned invoices; unixodbc + Microsoft's ODBC Driver 18 let the buyer assistant reach its SQL Server database.
COPY --from=python:3.12-slim-bookworm /usr/local /usr/local
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng curl gnupg ca-certificates unixodbc \
       libffi8 libexpat1 libsqlite3-0 libbz2-1.0 liblzma5 libncursesw6 libreadline8 libuuid1 \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && ldconfig \
    && rm -rf /var/lib/apt/lists/*
COPY python-backend/requirements.txt python-backend/requirements.txt
RUN pip install --no-cache-dir -r python-backend/requirements.txt
COPY python-backend/app python-backend/app
COPY python-backend/appsettings*.json python-backend/
ENV OCR_LANGUAGE=eng \
    MAX_UPLOAD_MB=20

COPY --from=build /app/gateway    ./gateway
COPY --from=build /app/identity   ./identity
COPY --from=build /app/masterdata ./masterdata
COPY --from=build /app/buyer      ./buyer
COPY --from=build /app/supplier   ./supplier
COPY start.sh .
RUN chmod +x start.sh

# UAT: enables downstream swagger (consumed by SwaggerForOcelot) and picks
# the appsettings.UAT.json connection strings that point at the shared
# SQL Server instead of the broken localhost/Production values.
ENV ASPNETCORE_ENVIRONMENT=UAT

EXPOSE 8000

CMD ["./start.sh"]
