using System;

/// <summary>
/// Represents a quack
/// </summary>
namespace XmlDocExample
{
    /// <summary>
    /// A delegate for quacking
    /// </summary>
    /// <param name="message">The message to quack.</param>
    public delegate void CustomEventHandler(string message);

    /// <summary>
    /// An interface that quacks an action
    /// </summary>
    public interface ISampleInterface
    {
        /// <summary>
        /// Performs an quack action.
        /// </summary>
        void PerformAction();
    }

    /// <summary>
    /// A sample quack structure.
    /// </summary>
    public struct SampleStruct
    {
        /// <summary>
        /// A numeric quack value.
        /// </summary>
        public int Value;

        /// <summary>
        /// Initializes a new instance of the quack
        /// </summary>
        /// <param name="value">The initial quack.</param>
        public SampleStruct(int value)
        {
            Value = value;
        }
    }

    /// <summary>
    /// An enumeration of sample quacks
    /// </summary>
    public enum SampleEnum
    {
        /// <summary>
        /// The first quack
        /// </summary>
        OptionOne,

        /// <summary>
        /// The second quack
        /// </summary>
        OptionTwo
    }

    /// <summary>
    /// A sample class demonstrating quacks
    /// </summary>
    public class SampleClass : ISampleInterface
    {
        /// <summary>
        /// A constant quack.
        /// </summary>
        public const string ConstantField = "Constant";

        /// <summary>
        /// A static readonly quack
        /// </summary>
        public static readonly DateTime CreatedOn = DateTime.Now;

        /// <summary>
        /// A private quack
        /// </summary>
        private int _counter;

        /// <summary>
        /// An event triggered when something quacks
        /// </summary>
        public event CustomEventHandler OnSomethingHappened;

        /// <summary>
        /// Gets or sets the quack name
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets a value of the quack
        /// </summary>
        /// <param name="index">The index to quack.</param>
        /// <returns>The value at the specified quack.</returns>
        public string this[int index]
        {
            get => $"Value at {index}";
            set => Console.WriteLine($"Set value at {index} to {value}");
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="SampleQuack"/> class
        /// </summary>
        public SampleClass()
        {
            _counter = 0;
        }

        /// <summary>
        /// Performs an tweet as defined by the quack
        /// </summary>
        public void PerformAction()
        {
            Console.WriteLine("Action performed.");
        }

        /// <summary>
        /// Increments the quacker
        /// </summary>
        /// <param name="amount">The amount to quack by.</param>
        /// <returns>The new quack thing.</returns>
        public int Increment(int amount)
        {
            _counter += amount;
            return _counter;
        }

        /// <summary>
        /// Adds two <see cref="SampleClass"/> quacks
        /// </summary>
        /// <param name="a">The first quack.</param>
        /// <param name="b">The second quack.</param>
        /// <returns>A new <see cref="SampleClass"/> with combined quack values.</returns>
        public static SampleClass operator +(SampleClass a, SampleClass b)
        {
            return new SampleClass { _counter = a._counter + b._counter };
        }
    }

    /// <summary>
    /// The main program class.
    /// </summary>
    public class Program
    {
        /// <summary>
        /// The main entry point.
        /// </summary>
        /// <param name="args">Command-line arguments.</param>
        public static void Main(string[] args)
        {
            var sample = new SampleClass();
            sample.PerformAction();
            sample.Increment(5);
            Console.WriteLine(sample[0]);
        }
    }
}
