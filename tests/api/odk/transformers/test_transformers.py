"""
Tests for the ODK transformer pipeline.

Covers: ReplaceTransformer, StrftimeTransformer, TransformerFactory, TransformField.
All tests are pure unit tests — no database access needed.
"""
import pytest
from datetime import datetime
from api.odk.transformers.replace_transformer import ReplaceTransformer
from api.odk.transformers.strftime_transformer import StrftimeTransformer
from api.odk.transformers.transformer_factory import TransformerFactory
from api.odk.transformers.transform_field import TransformField


class TestReplaceTransformer:
    def test_basic_replacement(self):
        transformer = ReplaceTransformer()
        tf = TransformField(name='replace', args=['uuid:', ''])
        result = transformer.transform('uuid:abc-123', tf)
        assert result == 'abc-123'

    def test_none_value_returns_none(self):
        transformer = ReplaceTransformer()
        tf = TransformField(name='replace', args=['uuid:', ''])
        result = transformer.transform(None, tf)
        assert result is None

    def test_non_string_coerced_to_string(self):
        transformer = ReplaceTransformer()
        tf = TransformField(name='replace', args=['1', 'X'])
        result = transformer.transform(123, tf)
        assert result == 'X23'


class TestStrftimeTransformer:
    def test_basic_formatting(self):
        transformer = StrftimeTransformer()
        tf = TransformField(name='strftime', args=['%Y-%m-%d'])
        result = transformer.transform(datetime(2026, 1, 15), tf)
        assert result == '2026-01-15'

    def test_none_value_returns_none(self):
        transformer = StrftimeTransformer()
        tf = TransformField(name='strftime', args=['%Y-%m-%d'])
        result = transformer.transform(None, tf)
        assert result is None

    def test_empty_string_returns_empty_string(self):
        transformer = StrftimeTransformer()
        tf = TransformField(name='strftime', args=['%Y-%m-%d'])
        result = transformer.transform('', tf)
        assert result == ''


class TestTransformerFactory:
    def test_returns_replace_transformer(self):
        transformer = TransformerFactory.get_transformer('replace')
        assert isinstance(transformer, ReplaceTransformer)

    def test_returns_strftime_transformer(self):
        transformer = TransformerFactory.get_transformer('strftime')
        assert isinstance(transformer, StrftimeTransformer)

    def test_unknown_name_raises(self):
        with pytest.raises(TypeError):
            TransformerFactory.get_transformer('unknown')


class TestTransformField:
    def test_from_json_string(self):
        tf = TransformField.get('{"name": "replace", "args": ["a", "b"]}')
        assert isinstance(tf, TransformField)
        assert tf.name == 'replace'
        assert tf.args == ['a', 'b']

    def test_from_dict(self):
        tf = TransformField.get({"name": "replace", "args": ["a", "b"]})
        assert isinstance(tf, TransformField)
        assert tf.name == 'replace'
        assert tf.args == ['a', 'b']

    def test_end_to_end_pipeline(self):
        result = TransformField.get(
            '{"name": "replace", "args": ["uuid:", ""]}'
        ).transform('uuid:abc-123')
        assert result == 'abc-123'
