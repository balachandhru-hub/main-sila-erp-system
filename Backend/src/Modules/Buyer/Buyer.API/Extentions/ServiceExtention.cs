using Microsoft.AspNetCore.DataProtection;
using SharedKernel.Integration;
using SharedKernel.Integration.Services;
using Buyer.Application.Services.Jobs;
using Quartz;
using SharedKernel.ExceptionHandler;
using Microsoft.EntityFrameworkCore;
using Services;
using Buyer.Domain.Common;
using System.Threading.RateLimiting;
using Buyer.Infrastructure.Contracts.IServices;
using Buyer.Infrastructure.DbContext;
using SharedKernel.LoggerServices;
using Buyer.Application.Services;
using Buyer.Application.Services.Integration;
using Buyer.Application.Features.Queries.GetOrganizationProfile;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.Repository;
using Buyer.Application.Contracts;
using Buyer.Infrastructure.ApiClients;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using HashingSystem;






namespace Buyer.API.Extensions
{
    /// <summary>
    /// Class <c>Service Extenstions</c> is static consists of service extensions.
    /// Contains static method to configure the services required to run the application.
    /// </summary>
    public static class ServiceExtensions
    {
        /// <summary>
        /// This method is used to configure the CORS (Cross-Origin Resource Sharing).
        /// CORS is a mechanism that gives rights to the user to access resources
        /// from the server on a different domain
        /// </summary>
        public static void ConfigureCors(this IServiceCollection services, IConfiguration config)
        {
            _ = services.AddCors(options =>
            {
                options.AddPolicy(
                    "CorsPolicy",
                    builder =>
                        builder
                            .SetIsOriginAllowed(origin =>

                        origin.Equals(config[Common.DEFAULT_FRONT_END_ORIGIN_LOCAL]!, StringComparison.OrdinalIgnoreCase)

                    )
                            .AllowAnyMethod()
                            .AllowAnyHeader()
                            .AllowCredentials()
                            .WithExposedHeaders("Content-Disposition")
                );
            });
        }
        /// <summary>
        /// This method is used to configure the rate limiting for the APIs. It limits the number of requests from a single IP address to prevent abuse and protect the server from overload.
        /// </summary> <param name="services"></param>
        public static void ConfigureRateLimiting(this IServiceCollection services)
        {
            // Forwarded Headers (for real IP behind proxy)
            services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders =
                    Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor;
            });

            // Rate Limiter
            services.AddRateLimiter(options =>
            {
                options.AddPolicy("LoginPolicy", httpContext =>
                    RateLimitPartition.GetFixedWindowLimiter(
                       partitionKey: httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault()
                            ?? httpContext.Connection.RemoteIpAddress?.ToString()
                            ?? "unknown",
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 5,
                            Window = TimeSpan.FromMinutes(1),
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        }));

                options.OnRejected = async (context, token) =>
                {
                    context.HttpContext.Response.StatusCode = 429;
                    context.HttpContext.Response.ContentType = "application/json";

                    var response = new
                    {
                        status_code = 429,
                        message = "Maximum limit reached. Please try again later.",
                        description = "Too many requests from this IP. Please try again later."
                    };

                    await context.HttpContext.Response.WriteAsJsonAsync(response);
                };
            });
        }
        /// <summary>
        /// This method is used to configure the IIS integration helps to configure the
        /// properties for IIS server deployment.
        /// </summary>
        public static void ConfigureIISIntegration(this IServiceCollection services)
        {
            _ = services.Configure<IISOptions>(options => { });
        }

        /// <summary>
        /// This method is used to inject logger service inside the .NET Core’s IOC container with
        /// singleton scope.
        /// </summary>
        public static void ConfigureLoggerService(this IServiceCollection services)
        {
            _ = services.AddSingleton<ILoggerManager, LoggerManager>();
        }

        /// <summary>
        /// This method is used to inject the repository context into IOC with DBContext scope.
        /// </summary>
        /// <paramref name="config">The config paramter used to read attributes in appsettings.json</paramref>
        public static void ConfigureDBContext(
            this IServiceCollection services,
            IConfiguration config
        )
        {
            string dbString = config.GetConnectionString("DefaultConnection")!;
            services.AddDbContext<RepositoryContext>(options =>
            {
                options.UseSqlServer(dbString);
            });
        }

        /// <summary>
        /// This method is used to inject the services where the business logics are implemented.
        /// </summary>
        public static void ConfigureServiceWrapper(
            this IServiceCollection services
        )
        {
            _ = services.AddScoped<IUserIdentityService, UserIdentityService>();
            _ = services.AddScoped<IUserContext, UserContext>();
            _ = services.AddScoped<IMetadataApiClient, MetadataApiClient>();
            _ = services.AddScoped<IIdentityApiClient, IdentityApiClient>();
            _ = services.AddScoped<ISupplierApiClient, SupplierApiClient>();
            _ = services.AddScoped<ISupplierSalesOrderClient, SupplierApiClient>();
            _ = services.AddScoped<IBuyerPurchaseDocumentGateway, BuyerPurchaseDocumentGateway>();
            _ = services.AddScoped<IAesEncryption, AesEncryption>();
            _ = services.AddScoped<IStockInHandProvider, ErpStockInHandProvider>();
            _ = services.AddControllers();

        }

        /// <summary>
        /// This method is used to inject the API integration engine: the HTTP executor, the credential
        /// protector (its key ring is kept under FolderPath:BasePath so it survives a restart of the
        /// container).
        /// </summary>
        public static void ConfigureIntegrationEngine(this IServiceCollection services, IConfiguration config)
        {
            _ = services.AddScoped<IIntegrationCredentialProtector, IntegrationCredentialProtector>();
            _ = services.AddScoped<IIntegrationHttpExecutor, IntegrationHttpExecutor>();
            _ = services.AddHttpClient(IntegrationConstants.HTTP_CLIENT_INTEGRATIONS);
            _ = services.AddHttpClient(Common.HTTP_CLIENT_OCR, client =>
            {
                client.BaseAddress = new Uri(config[Common.OCR_SERVICE_URL]!.TrimEnd('/') + "/");
                client.Timeout = TimeSpan.FromSeconds(120);
            });

            string basePath = string.IsNullOrWhiteSpace(config[Common.BASE_FOLDER_PATH]) ? AppContext.BaseDirectory : config[Common.BASE_FOLDER_PATH]!;
            _ = services.AddDataProtection()
                .SetApplicationName("ProcurementSuite.Buyer")
                .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(basePath, Common.DATA_PROTECTION_SUBFOLDER)));
        }

        /// <summary>
        /// This method is used to register the Quartz jobs. Each cron expression comes from the
        /// Scheduler section of appsettings.
        /// </summary>
        public static void ConfigureSchedulers(this IServiceCollection services, IConfiguration config)
        {
            _ = services.AddQuartz(quartz =>
            {
                JobKey integrationJobKey = new JobKey(nameof(IntegrationSchedulerJob));
                _ = quartz.AddJob<IntegrationSchedulerJob>(options => options.WithIdentity(integrationJobKey));
                _ = quartz.AddTrigger(options => options
                    .ForJob(integrationJobKey)
                    .WithIdentity($"{nameof(IntegrationSchedulerJob)}Trigger")
                    .WithCronSchedule(config[Common.SCHEDULER_INTEGRATION_CRON]!));

                JobKey recipeSubstitutionJobKey = new JobKey(nameof(RecipeSubstitutionJob));
                _ = quartz.AddJob<RecipeSubstitutionJob>(options => options.WithIdentity(recipeSubstitutionJobKey));
                _ = quartz.AddTrigger(options => options
                    .ForJob(recipeSubstitutionJobKey)
                    .WithIdentity($"{nameof(RecipeSubstitutionJob)}Trigger")
                    .WithCronSchedule(config[Common.SCHEDULER_SUBSTITUTION_CRON]!));

                JobKey physicalInventoryJobKey = new JobKey(nameof(PhysicalInventoryJob));
                _ = quartz.AddJob<PhysicalInventoryJob>(options => options.WithIdentity(physicalInventoryJobKey));
                _ = quartz.AddTrigger(options => options
                    .ForJob(physicalInventoryJobKey)
                    .WithIdentity($"{nameof(PhysicalInventoryJob)}Trigger")
                    .WithCronSchedule(config[Common.SCHEDULER_PHYSICAL_INVENTORY_CRON]!));

                JobKey inventoryErpPostingJobKey = new JobKey(nameof(InventoryErpPostingJob));
                _ = quartz.AddJob<InventoryErpPostingJob>(options => options.WithIdentity(inventoryErpPostingJobKey));
                _ = quartz.AddTrigger(options => options
                    .ForJob(inventoryErpPostingJobKey)
                    .WithIdentity($"{nameof(InventoryErpPostingJob)}Trigger")
                    .WithCronSchedule(config[Common.SCHEDULER_ERP_POSTING_CRON]!));

                JobKey inventoryAlertJobKey = new JobKey(nameof(InventoryAlertJob));
                _ = quartz.AddJob<InventoryAlertJob>(options => options.WithIdentity(inventoryAlertJobKey));
                _ = quartz.AddTrigger(options => options
                    .ForJob(inventoryAlertJobKey)
                    .WithIdentity($"{nameof(InventoryAlertJob)}Trigger")
                    .WithCronSchedule(config[Common.SCHEDULER_ALERT_CRON]!));

                JobKey weeklyBucketJobKey = new JobKey(nameof(WeeklyBucketAutomationJob));
                _ = quartz.AddJob<WeeklyBucketAutomationJob>(options => options.WithIdentity(weeklyBucketJobKey));
                _ = quartz.AddTrigger(options => options
                    .ForJob(weeklyBucketJobKey)
                    .WithIdentity($"{nameof(WeeklyBucketAutomationJob)}Trigger")
                    .WithCronSchedule(config[Common.SCHEDULER_WEEKLY_BUCKET_CRON] ?? "0 0/15 * * * ?"));

                JobKey posSalesPullJobKey = new JobKey(nameof(PosSalesPullJob));
                _ = quartz.AddJob<PosSalesPullJob>(options => options.WithIdentity(posSalesPullJobKey));
                _ = quartz.AddTrigger(options => options
                    .ForJob(posSalesPullJobKey)
                    .WithIdentity($"{nameof(PosSalesPullJob)}Trigger")
                    .WithCronSchedule(config[Common.SCHEDULER_POS_PULL_CRON]!));
            });
            _ = services.AddQuartzHostedService(options => options.WaitForJobsToComplete = true);

            // Jobs that are scheduled in code through ISchedulerService (for example the weekly bucket reminder).
            _ = services.AddTransient<WeeklyBucketReminderJob>();
            _ = services.AddSingleton<ISchedulerService, SchedulerService>();
            _ = services.AddHostedService<SchedulerStartupService>();
        }

        /// <summary>
        /// This method is used to inject the entity repository as scoped instance.
        /// </summary>
        public static void ConfigureRepositoryWrapper(this IServiceCollection services)
        {
            _ = services.AddScoped<IRepositoryWrapper, RepositoryWrapper>();
        }

        /// <summary>
        /// This method is used to inject the mappings of Entities and Dto.
        /// </summary>


        /// <summary>
        /// This method is used to inject the custom exception middleware.
        /// </summary>
        public static IApplicationBuilder UseHttpStatusCodeExceptionMiddleware(
            this IApplicationBuilder builder
        )
        {
            return builder.UseMiddleware<CustomExceptionMiddleware>();
        }
        public static void ConfigureMediatR(this IServiceCollection services)
        {
            services.AddMediatR(cfg =>
            {
                cfg.RegisterServicesFromAssembly(typeof(GetOrganizationProfileQuery).Assembly);
            });
        }



        public static void ConfigureAuthentication(
               this IServiceCollection services
           )
        {
            services
                .AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
                })
                .AddJwtBearer(options =>
                {
                    options.RequireHttpsMetadata = false;
                    options.SaveToken = true;

                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateAudience = false,
                        ValidateIssuer = false,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(
                            Encoding.UTF8.GetBytes("1kt6ryCXoY13_9LrCfyfF_wSgPVxlewGtrBlY0PkyxA")
                        ),
                        ValidateLifetime = false,
                        ClockSkew = TimeSpan.Zero //the default for this setting is 5 minutes
                    };

                    options.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = context =>
                        {
                            if (context.Request.Cookies.TryGetValue(Common.ACCESS_TOKEN, out var token))
                            {
                                context.Token = token;
                            }
                            return Task.CompletedTask;
                        },
                        OnAuthenticationFailed = context =>
                        {
                            if (
                                context.Exception.GetType() == typeof(SecurityTokenExpiredException)
                            )
                            {
                                context.Response.Headers.Append("Token-Expired", "true");
                            }
                            return Task.CompletedTask;
                        }
                    };
                });
        }


    }
}
