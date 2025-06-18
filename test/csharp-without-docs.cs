using System;

namespace XmlDocExample
{
    public delegate void CustomEventHandler(string message);

    public interface ISampleInterface
    {
        void PerformAction();
    }

    public struct SampleStruct
    {
        public int Value;

        public SampleStruct(int value)
        {
            Value = value;
        }
    }

    public enum SampleEnum
    {
        OptionOne,

        OptionTwo
    }

    public class SampleClass : ISampleInterface
    {
        public const string ConstantField = "Constant";

        public static readonly DateTime CreatedOn = DateTime.Now;

        private int _counter;

        public event CustomEventHandler OnSomethingHappened;

        public string Name { get; set; }

        public string this[int index]
        {
            get => $"Value at {index}";
            set => Console.WriteLine($"Set value at {index} to {value}");
        }

        public SampleClass()
        {
            _counter = 0;
        }

        public void PerformAction()
        {
            Console.WriteLine("Action performed.");
        }

        public int Increment(int amount)
        {
            _counter += amount;
            return _counter;
        }

        public static SampleClass operator +(SampleClass a, SampleClass b)
        {
            return new SampleClass { _counter = a._counter + b._counter };
        }
    }

    public class Program
    {
        public static void Main(string[] args)
        {
            var sample = new SampleClass();
            sample.PerformAction();
            sample.Increment(5);
            Console.WriteLine(sample[0]);
        }
    }
}
