"""This is a module-level docstring.

It provides an overview of the module's purpose and usage.
"""

import math

class MyClass:
    """This is a class docstring.

    It describes the purpose of the class and its usage.
    """

    class_variable = 42

    def __init__(self, value):
        """Constructor docstring.

        Args:
            value (int): The initial value.
        """
        self.value = value

    def instance_method(self):
        """Instance method docstring.

        Returns:
            int: The stored value.
        """
        return self.value

    @classmethod
    def class_method(cls):
        """Class method docstring.

        Returns:
            int: The class variable.
        """
        return cls.class_variable
    @staticmethod
    def static_method():
        """Static method docstring.

        Returns:
            str: A static message.
        """
        return "This is a static method."

def my_function(param1, param2):
    """Function docstring.

    Args:
        param1 (int): The first parameter.
        param2 (int): The second parameter.

    Returns:
        int: The sum of the parameters.
    """
    return param1 + param2

def outer_function():
    """Outer function docstring."""

    def inner_function():
        """Inner function docstring."""
        return "Hello from the inner function!"

    return inner_function()

lambda_with_doc = lambda x: x + 1
lambda_with_doc.__doc__ = "Lambda function docstring."

# Demonstrating docstring on a generator
def my_generator():
    """Generator function docstring."""
    yield from range(3)

# Demonstrating docstring on a coroutine (Python 3.5+)
async def my_coroutine():
    """Coroutine function docstring."""
    return "Hello async"

