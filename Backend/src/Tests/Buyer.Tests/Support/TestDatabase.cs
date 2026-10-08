using Buyer.Infrastructure.Contracts.IServices;
using Buyer.Infrastructure.DbContext;
using Buyer.Infrastructure.Repository;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SharedKernel.LoggerServices;

namespace Buyer.Tests.Support
{
    /// <summary>An in-memory RepositoryContext and the real RepositoryWrapper on top of it, one database per instance.</summary>
    public sealed class TestDatabase : IDisposable
    {
        public RepositoryContext Context { get; }

        public RepositoryWrapper Repository { get; }

        public FakeLogger Logger { get; } = new FakeLogger();

        public TestDatabase()
        {
            IConfiguration configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Schema"] = "dbo",
                    ["ConnectionStrings:DefaultConnection"] = "unused"
                })
                .Build();
            DbContextOptions<RepositoryContext> options = new DbContextOptionsBuilder<RepositoryContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString(), inMemory => inMemory.EnableNullChecks(false))
                .Options;
            Context = new RepositoryContext(options, configuration);
            Repository = new RepositoryWrapper(Context, new FakeUserIdentityService(), configuration, Logger);
        }

        /// <summary>Adds the rows, saves, and detaches everything so the code under test reads fresh state.</summary>
        public void Seed(params object[] entities)
        {
            Context.AddRange(entities);
            Context.SaveChanges();
            Context.ChangeTracker.Clear();
        }

        public void Dispose()
        {
            Context.Dispose();
        }
    }

    public sealed class FakeUserIdentityService : IUserIdentityService
    {
        public Guid GetCurrentUser()
        {
            return Guid.Empty;
        }
    }

    public sealed class FakeLogger : ILoggerManager
    {
        public List<string> Errors { get; } = new List<string>();

        public void LogInfo(string message)
        {
        }

        public void LogDebug(string message)
        {
        }

        public void LogError(string message)
        {
            Errors.Add(message);
        }
    }
}
