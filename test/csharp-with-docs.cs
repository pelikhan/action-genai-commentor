using System;

/// <summary>
/// Represents a sample program demonstrating XML documentation comments.
/// </summary>
namespace XmlDocExample
{
    /// <summary>
    /// A delegate for handling custom events.
    /// </summary>
    /// <param name="message">The message passed to the event handler.</param>
    public delegate void CustomEventHandler(string message);

    /// <summary>
    /// An interface that defines a sample contract.
    /// </summary>
    public interface ISampleInterface
    {
        /// <summary>
        /// Performs an action.
        /// </summary>
        void PerformAction();
    }

    /// <summary>
    /// A sample struct with XML documentation.
    /// </summary>
    public struct SampleStruct
    {
        /// <summary>
        /// A numeric value.
        /// </summary>
        public int Value;

        /// <summary>
        /// Initializes a new instance of the <see cref="SampleStruct"/> struct.
        /// </summary>
        /// <param name="value">The initial value.</param>
        public SampleStruct(int value)
        {
            Value = value;
        }
    }

    /// <summary>
    /// An enumeration of sample options.
    /// </summary>
    public enum SampleEnum
    {
        /// <summary>
        /// The first option.
        /// </summary>
        OptionOne,

        /// <summary>
        /// The second option.
        /// </summary>
        OptionTwo
    }

    /// <summary>
    /// A sample class demonstrating XML documentation.
    /// </summary>
    public class SampleClass : ISampleInterface
    {
        /// <summary>
        /// A constant field.
        /// </summary>
        public const string ConstantField = "Constant";

        /// <summary>
        /// A static readonly field.
        /// </summary>
        public static readonly DateTime CreatedOn = DateTime.Now;

        /// <summary>
        /// A private field.
        /// </summary>
        private int _counter;

        /// <summary>
        /// An event triggered when something happens.
        /// </summary>
        public event CustomEventHandler OnSomethingHappened;

        /// <summary>
        /// Gets or sets the name.
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets a value using an index.
        /// </summary>
        /// <param name="index">The index to access.</param>
        /// <returns>The value at the specified index.</returns>
        public string this[int index]
        {
            get => $"Value at {index}";
            set => Console.WriteLine($"Set value at {index} to {value}");
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="SampleClass"/> class.
        /// </summary>
        public SampleClass()
        {
            _counter = 0;
        }

        /// <summary>
        /// Performs an action as defined by the interface.
        /// </summary>
        public void PerformAction()
        {
            Console.WriteLine("Action performed.");
        }

        /// <summary>
        /// Increments the counter.
        /// </summary>
        /// <param name="amount">The amount to increment by.</param>
        /// <returns>The new counter value.</returns>
        public int Increment(int amount)
        {
            _counter += amount;
            return _counter;
        }

        /// <summary>
        /// Adds two <see cref="SampleClass"/> instances.
        /// </summary>
        /// <param name="a">The first instance.</param>
        /// <param name="b">The second instance.</param>
        /// <returns>A new <see cref="SampleClass"/> with combined counter values.</returns>
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
