# Fix Jina Model Compatibility Issue

The error `'XLMRobertaLoRA' object has no attribute 'all_tied_weights_keys'` is caused by incompatibility between Jina models and transformers 5.5.4.

## Solution: Downgrade transformers

Run this command in your activated jina_env:

```powershell
pip install transformers==4.44.2
```

This will downgrade transformers from 5.5.4 to 4.44.2, which is compatible with Jina models.

## Then restart the service:

```powershell
python server\routes\embedding_service.py
```

---

## Full Command Sequence:

```powershell
.\jina_env\Scripts\Activate.ps1
pip install transformers==4.44.2
python server\routes\embedding_service.py
```
