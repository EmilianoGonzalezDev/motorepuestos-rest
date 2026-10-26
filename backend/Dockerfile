# syntax=docker/dockerfile:1.7
# Build context: ./backend

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first (cached while the project files and package versions don't change)
COPY global.json Directory.Build.props Directory.Packages.props ./
COPY src/MotoRepuestos.Domain/*.csproj src/MotoRepuestos.Domain/
COPY src/MotoRepuestos.Application/*.csproj src/MotoRepuestos.Application/
COPY src/MotoRepuestos.Infrastructure/*.csproj src/MotoRepuestos.Infrastructure/
COPY src/MotoRepuestos.Api/*.csproj src/MotoRepuestos.Api/
RUN dotnet restore src/MotoRepuestos.Api/MotoRepuestos.Api.csproj

COPY src/ src/
RUN dotnet publish src/MotoRepuestos.Api/MotoRepuestos.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Product images live on a volume so they survive container re-creation
RUN mkdir -p /data/images && chown -R $APP_UID /data
ENV ASPNETCORE_URLS=http://+:8080 \
    ImageStorage__RootPath=/data/images \
    Auth__SecureCookies=false \
    DOTNET_gcServer=0 \
    DOTNET_EnableDiagnostics=0

COPY --from=build /app .
USER $APP_UID
EXPOSE 8080
VOLUME /data/images

HEALTHCHECK --interval=15s --timeout=3s --start-period=40s --retries=5 \
  CMD ["dotnet", "MotoRepuestos.Api.dll", "--healthcheck"] || exit 1
ENTRYPOINT ["dotnet", "MotoRepuestos.Api.dll"]
