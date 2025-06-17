import math

class MyClass:
    class_variable = 42

    def __init__(self, value):
        self.value = value

    def instance_method(self):
        return self.value

    @classmethod
    def class_method(cls):
        return cls.class_variable
    @staticmethod
    def static_method():
        return "This is a static method."

def my_function(param1, param2):
    return param1 + param2

def outer_function():

    def inner_function():
        return "Hello from the inner function!"

    return inner_function()

lambda_with_doc = lambda x: x + 1
lambda_with_doc.__doc__ = "Lambda function docstring."

# Demonstrating docstring on a generator
def my_generator():
    yield from range(3)

# Demonstrating docstring on a coroutine (Python 3.5+)
async def my_coroutine():
    return "Hello async"

